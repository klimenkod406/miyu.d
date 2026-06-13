"""Heuristic structural segmentation for song structure analysis.

Classifies Whisper VAD segments into structural parts of a song:
verse, chorus, bridge, intro, outro.

Uses only text similarity heuristics (difflib.SequenceMatcher) + timing/energy
patterns. No ML models, no external dependencies beyond Python stdlib.
"""

from __future__ import annotations

import difflib
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

CHORUS_SIM_THRESHOLD: float = 0.65
"""Minimum SequenceMatcher ratio for two segments to be considered similar
enough to form a chorus cluster."""

INTRO_MAX_DURATION_FRAC: float = 0.15
"""Maximum fraction of total song duration an intro can occupy."""

INTRO_MAX_CHARS: int = 40
"""Maximum character length for an intro segment. If the very first segment
exceeds this, no intro is detected."""

OUTRO_MAX_DURATION_FRAC: float = 0.10
"""Maximum fraction of total song duration an outro can occupy."""

VERSE_MIN_DURATION: float = 8.0
"""Minimum duration in seconds for a segment to be considered a verse
(rather than a transitional segment)."""

TYPE_TO_LABEL: dict[str, str] = {
    "intro": "Интро",
    "verse": "Куплет",
    "chorus": "Припев",
    "bridge": "Бридж",
    "outro": "Аутро",
}
"""Mapping from internal type names to Russian display labels."""

# ── Public API ─────────────────────────────────────────────────────────────────


def analyze(
    segments: list[dict[str, Any]],
    features: dict[str, Any] | None = None,
    duration_sec: float = 0.0,
) -> list[dict[str, Any]]:
    """Classify Whisper segments into structural song parts.

    Implements a 7-step heuristic algorithm:

      1. Input validation — rejects empty segments or zero duration.
      2. Text similarity matrix — pairwise ``difflib.SequenceMatcher.ratio()``.
      3. Chorus detection — finds repeated-text clusters via connected
         components on the similarity graph; the largest cluster is the
         primary chorus.
      4. Label assignment — intro / verse / chorus / bridge / outro based
         on position, duration, text length, and chorus membership.
      5. Structural smoothing — ``[intro] [verse] [chorus] [verse] [chorus]
         [bridge] [chorus] [outro]`` prior + between-same-type gap filling.
      6. Merge adjacent same-type segments into contiguous blocks.
      7. Return sorted blocks.

    Args:
        segments: List of Whisper segment dicts, each with ``start`` (float),
            ``end`` (float), and ``text`` (str) keys.  May optionally carry
            a ``words`` key (word-level timestamps).
        features: Optional audio features dict (see ``audio_features.py``).
            Used for diagnostic logging.  The algorithm does **not** depend
            on it.
        duration_sec: Total song duration in seconds.  If <= 0 the function
            returns an empty list immediately.

    Returns:
        List of structural blocks sorted by ``start`` time.  Each block is a
        dict with keys:

        - ``type`` — one of ``intro|verse|chorus|bridge|outro``
        - ``label`` — Russian label (``Интро|Куплет|Припев|Бридж|Аутро``)
        - ``start`` — block start time in seconds
        - ``end`` — block end time in seconds
        - ``segment_indices`` — list of original segment indices merged into
          this block
    """
    # ── Step 1: Input Validation ───────────────────────────────────────────────
    if not segments or duration_sec <= 0:
        logger.warning("analyze: empty segments or non-positive duration (%.2f)", duration_sec)
        return []

    n = len(segments)
    texts = [str(s.get("text", "") or "").strip() for s in segments]

    if features:
        logger.info(
            "analyze: %d segments, duration=%.1fs, bpm=%s, key=%s",
            n, duration_sec,
            features.get("bpm"), features.get("key"),
        )
    else:
        logger.info("analyze: %d segments over %.1fs (no features)", n, duration_sec)

    # ── Step 2: Text Similarity Matrix ─────────────────────────────────────────
    sim = _build_similarity_matrix(texts)

    # ── Step 3: Chorus Detection ───────────────────────────────────────────────
    primary_chorus = _detect_chorus_clusters(sim, n)

    # ── Step 4: Label Assignment ───────────────────────────────────────────────
    labels = _assign_labels(segments, texts, primary_chorus, duration_sec, n)

    # ── Step 5: Structural Smoothing ───────────────────────────────────────────
    labels = _smooth_labels(segments, labels, primary_chorus, duration_sec, n)

    # ── Step 6: Merge Adjacent Same-Type Segments ──────────────────────────────
    blocks = _merge_adjacent(segments, labels, n)

    logger.info(
        "analyze: %d blocks — %s",
        len(blocks),
        " → ".join(f"{b['type']}(x{len(b['segment_indices'])})" for b in blocks),
    )

    return blocks


# ── Internal helpers ───────────────────────────────────────────────────────────


def _build_similarity_matrix(texts: list[str]) -> list[list[float]]:
    """Build an N×N pairwise text similarity matrix using SequenceMatcher.

    Empty strings produce 0.0 similarity with any other string (including
    another empty string) to avoid matching silence/instrumental segments.
    """
    n = len(texts)
    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        sim[i][i] = 1.0
        for j in range(i + 1, n):
            ti, tj = texts[i], texts[j]
            if ti and tj:
                ratio = difflib.SequenceMatcher(
                    None, ti.lower(), tj.lower()
                ).ratio()
                sim[i][j] = sim[j][i] = ratio
            # else stays 0.0 (empty vs empty or empty vs content)
    return sim


def _detect_chorus_clusters(
    sim: list[list[float]], n: int,
) -> set[int]:
    """Find chorus clusters via connected components on the similarity graph.

    Two segments are connected when ``sim[i][j] >= CHORUS_SIM_THRESHOLD``.
    The **largest** connected component is returned as the primary chorus.
    When multiple components share the same size, the one with the highest
    average pairwise similarity is preferred (this avoids false-positive
    verse clusters that barely cross the threshold).

    Returns:
        Set of segment indices belonging to the primary chorus, or an empty
        set if no chorus cluster was found.
    """
    # Build adjacency for edges above threshold
    adj: dict[int, set[int]] = {i: set() for i in range(n)}
    candidates: set[int] = set()
    for i in range(n):
        for j in range(i + 1, n):
            if sim[i][j] >= CHORUS_SIM_THRESHOLD:
                adj[i].add(j)
                adj[j].add(i)
                candidates.add(i)
                candidates.add(j)

    if not candidates:
        logger.debug("no chorus candidates found")
        return set()

    # Find connected components via DFS
    visited: set[int] = set()
    clusters: list[set[int]] = []
    for node in candidates:
        if node in visited:
            continue
        cluster: set[int] = set()
        stack = [node]
        while stack:
            v = stack.pop()
            if v not in visited:
                visited.add(v)
                cluster.add(v)
                stack.extend(adj[v] - visited)
        clusters.append(cluster)

    if not clusters:
        return set()

    def _cluster_key(c: set[int]) -> tuple[int, float]:
        """Sort key: (size, average_pairwise_similarity)."""
        idxs = sorted(c)
        pairs = 0
        total = 0.0
        for a in range(len(idxs)):
            for b in range(a + 1, len(idxs)):
                total += sim[idxs[a]][idxs[b]]
                pairs += 1
        avg = total / pairs if pairs > 0 else 0.0
        return (len(c), avg)

    primary = max(clusters, key=_cluster_key)

    logger.debug(
        "chorus clusters: %d found, primary has %d members (avg_sim=%.3f): %s",
        len(clusters), len(primary), _cluster_key(primary)[1], sorted(primary),
    )
    return primary


def _assign_labels(
    segments: list[dict[str, Any]],
    texts: list[str],
    chorus_set: set[int],
    duration_sec: float,
    n: int,
) -> list[str]:
    """Assign initial structural labels to each segment.

    Order of assignment:
      1. Chorus — from the chorus cluster.
      2. Intro — short segments at the very beginning.
      3. Outro — short segments at the very end.
      4. Verse — default label for everything else.
      5. Bridge — non-chorus segments sandwiched between two chorus
         occurrences and shorter than adjacent verses.
    """
    labels: list[str | None] = [None] * n

    # ── 4a. Chorus ─────────────────────────────────────────────────────────
    for i in chorus_set:
        labels[i] = "chorus"

    first_chorus = min(chorus_set) if chorus_set else n
    last_chorus = max(chorus_set) if chorus_set else -1

    # ── 4b. Intro ──────────────────────────────────────────────────────────
    first_text = texts[0]
    if len(first_text) <= INTRO_MAX_CHARS:
        cum_dur = 0.0
        intro_end = -1  # sentinel: -1 means no intro detected
        # Walk forward from the start until we hit the first chorus or
        # exceed the intro timing/text-length budget.
        limit = min(n, first_chorus)
        for i in range(limit):
            seg = segments[i]
            seg_dur = seg["end"] - seg["start"]
            seg_text_len = len(texts[i])
            cum_dur += seg_dur
            if (
                cum_dur / duration_sec <= INTRO_MAX_DURATION_FRAC
                and seg_text_len <= INTRO_MAX_CHARS
            ):
                intro_end = i
            else:
                break
        if intro_end >= 0:
            for i in range(intro_end + 1):
                if labels[i] is None:
                    labels[i] = "intro"

    # ── 4c. Outro ──────────────────────────────────────────────────────────
    if chorus_set:
        outro_start = n  # default: no outro
        for i in range(n - 1, last_chorus, -1):
            seg = segments[i]
            seg_dur = seg["end"] - seg["start"]
            if seg_dur / duration_sec <= OUTRO_MAX_DURATION_FRAC:
                outro_start = i
            else:
                break
        for i in range(outro_start, n):
            if labels[i] is None:
                labels[i] = "outro"

    # ── 4d. Verse (default) ────────────────────────────────────────────────
    for i in range(n):
        if labels[i] is None:
            labels[i] = "verse"

    # ── 4e. Bridge ─────────────────────────────────────────────────────────
    if chorus_set:
        for i in range(n):
            if labels[i] != "verse":
                continue
            # Must have a chorus before AND after this segment
            has_before = any(j in chorus_set for j in range(i))
            has_after = any(j in chorus_set for j in range(i + 1, n))
            if not (has_before and has_after):
                continue

            seg_dur = segments[i]["end"] - segments[i]["start"]

            # Find nearest verse to the left
            left_dur = _nearest_verse_duration(segments, labels, i, -1)
            # Find nearest verse to the right
            right_dur = _nearest_verse_duration(segments, labels, i, +1)

            if seg_dur < left_dur and seg_dur < right_dur:
                labels[i] = "bridge"

    return labels  # type: ignore[return-value]


def _nearest_verse_duration(
    segments: list[dict[str, Any]],
    labels: list[str | None],
    start_idx: int,
    direction: int,
) -> float:
    """Find the duration of the nearest ``verse``-labeled segment in a direction.

    Args:
        segments: Full segment list.
        labels: Label array (parallel to segments).
        start_idx: Starting index.
        direction: ``-1`` to scan left, ``+1`` to scan right.

    Returns:
        Duration (seconds) of the nearest verse segment, or infinity if no
        verse is found in that direction.
    """
    idx = start_idx + direction
    while 0 <= idx < len(segments):
        if labels[idx] == "verse":
            return segments[idx]["end"] - segments[idx]["start"]
        idx += direction
    return float("inf")


def _smooth_labels(
    segments: list[dict[str, Any]],
    labels: list[str],
    chorus_set: set[int],
    duration_sec: float,
    n: int,
) -> list[str]:
    """Structural smoothing pass.

    Rules applied:
      1. *Gap filling* — if a segment sits between two same-type segments
         and is **not** a ``chorus`` or ``bridge``, match the neighbours'
         type.
      2. *Pop-song prior* — after a ``bridge`` the next non-bridge segment
         should be ``chorus``; if it is still ``verse``, promote it.
      3. *Fallback* — if no chorus was found, label everything (except
         ``intro`` / ``outro``) as ``verse``.
    """
    new_labels = list(labels)

    # ── 5a. Gap filling ────────────────────────────────────────────────────
    if n >= 3:
        for i in range(1, n - 1):
            if (
                new_labels[i - 1] == new_labels[i + 1]
                and new_labels[i] != new_labels[i - 1]
                and new_labels[i] not in ("chorus", "bridge")
            ):
                new_labels[i] = new_labels[i - 1]

    # ── 5b. Pop-song pattern prior: bridge → chorus ────────────────────────
    if chorus_set:
        for i in range(n - 1):
            if new_labels[i] == "bridge":
                # Find the next segment that is not bridge
                for j in range(i + 1, n):
                    if new_labels[j] != "bridge":
                        if new_labels[j] == "verse":
                            new_labels[j] = "chorus"
                        break

    # ── 5c. No-chorus fallback ─────────────────────────────────────────────
    if not chorus_set:
        for i in range(n):
            if new_labels[i] not in ("intro", "outro"):
                new_labels[i] = "verse"

    return new_labels


def _merge_adjacent(
    segments: list[dict[str, Any]],
    labels: list[str],
    n: int,
) -> list[dict[str, Any]]:
    """Merge consecutive segments with the same label into contiguous blocks."""
    blocks: list[dict[str, Any]] = []
    if n == 0:
        return blocks

    current_type = labels[0]
    current_start = segments[0]["start"]
    current_end = segments[0]["end"]
    current_indices = [0]

    for i in range(1, n):
        if labels[i] == current_type:
            current_end = segments[i]["end"]
            current_indices.append(i)
        else:
            blocks.append({
                "type": current_type,
                "label": TYPE_TO_LABEL[current_type],
                "start": current_start,
                "end": current_end,
                "segment_indices": current_indices,
            })
            current_type = labels[i]
            current_start = segments[i]["start"]
            current_end = segments[i]["end"]
            current_indices = [i]

    # Last block
    blocks.append({
        "type": current_type,
        "label": TYPE_TO_LABEL[current_type],
        "start": current_start,
        "end": current_end,
        "segment_indices": current_indices,
    })

    return blocks
