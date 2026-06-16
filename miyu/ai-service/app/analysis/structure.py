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
import re

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

MIN_GAP_FOR_BOUNDARY: float = 2.0
"""Minimum silence gap (seconds) between segments to indicate a likely
section boundary."""

LOW_CONFIDENCE_THRESHOLD: float = 0.7
"""Average word probability below this threshold suggests an instrumental
or non-vocal segment."""
CHORUS_MIN_TOTAL_DURATION: float = 3.0
"""Minimum total duration (seconds) for a chorus cluster to be valid."""

BRIDGE_MIN_DURATION: float = 3.0
"""Segments shorter than this labelled as bridge are reclassified as verse."""

MAX_BRIDGE_BLOCKS: int = 2
"""Maximum number of separate bridge blocks allowed in a single track."""

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
         primary chorus, filtered by duration constraints.
      4. Label assignment — intro / verse / chorus / bridge / outro based
         on position, duration, text length, chorus membership, and gap
         boundaries.
      5. Structural smoothing — gap filling + pop-song prior + bridge
         constraints + structural pattern validation.
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

    # ── Step 1b: Precompute auxiliary signals ──────────────────────────────────
    gap_boundaries = _analyze_gaps(segments, min_gap=MIN_GAP_FOR_BOUNDARY)
    low_conf_segments = _analyze_word_confidence(segments, threshold=LOW_CONFIDENCE_THRESHOLD)
    if gap_boundaries:
        logger.debug("gap boundaries at segment indices: %s", gap_boundaries)
    if low_conf_segments:
        logger.debug("low-confidence segments: %s", low_conf_segments)

    # ── Step 2: Text Similarity Matrix ─────────────────────────────────────────
    sim = _build_similarity_matrix(texts)

    # ── Step 3: Chorus Detection ───────────────────────────────────────────────
    primary_chorus = _detect_chorus_clusters(sim, n)

    # ── Step 3b: Chorus Duration Constraints ───────────────────────────────────
    primary_chorus = _filter_chorus_by_duration(segments, primary_chorus, duration_sec)

    # ── Step 4: Label Assignment ───────────────────────────────────────────────
    labels = _assign_labels(
        segments, texts, primary_chorus, duration_sec, n,
        gap_boundaries=gap_boundaries,
    )

    # ── Step 5: Structural Smoothing ───────────────────────────────────────────
    labels = _smooth_labels(
        segments, labels, primary_chorus, duration_sec, n,
        gap_boundaries=gap_boundaries,
        low_conf_segments=low_conf_segments,
    )

    # ── Step 6: Merge Adjacent Same-Type Segments ──────────────────────────────
    blocks = _merge_adjacent(segments, labels, n)

    # ── Step 6b: Post-merge bridge count safeguard ─────────────────────────
    # Ensure _merge_adjacent didn't produce excess bridge blocks
    bridge_blocks_final = [i for i, b in enumerate(blocks) if b["type"] == "bridge"]
    if len(bridge_blocks_final) > MAX_BRIDGE_BLOCKS:
        # Sort by duration, keep the longest MAX_BRIDGE_BLOCKS
        excess_count_final = len(bridge_blocks_final) - MAX_BRIDGE_BLOCKS
        # Compute durations for bridge blocks
        final_block_durs = []
        for idx in bridge_blocks_final:
            b = blocks[idx]
            dur = b["end"] - b["start"]
            final_block_durs.append((idx, dur))
        # Sort by duration ascending (shortest first)
        final_block_durs.sort(key=lambda x: x[1])
        for idx, dur in final_block_durs[:excess_count_final]:
            logger.debug(
                "post-merge: excess bridge block %d (dur=%.1fs) → verse",
                idx, dur,
            )
            blocks[idx]["type"] = "verse"
            blocks[idx]["label"] = TYPE_TO_LABEL["verse"]

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
    gap_boundaries: list[int] | None = None,
) -> list[str]:
    """Assign initial structural labels to each segment.

    Order of assignment:
      1. Chorus — from the chorus cluster.
      2. Intro — short segments at the very beginning (refined by gap analysis).
      3. Outro — short segments at the very end (refined by gap analysis).
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
        limit = min(n, first_chorus)

        # Find the first significant gap (if any) to constrain intro
        first_gap_boundary = None
        if gap_boundaries:
            # Only consider gaps before the first chorus candidate
            for gb in gap_boundaries:
                if gb < limit:
                    first_gap_boundary = gb
                    break

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
                # Stop at a significant gap boundary (strong structural signal)
                if first_gap_boundary is not None and i >= first_gap_boundary:
                    break
            else:
                break
        if intro_end >= 0:
            for i in range(intro_end + 1):
                if labels[i] is None:
                    labels[i] = "intro"

    # ── 4c. Outro ──────────────────────────────────────────────────────────
    if chorus_set:
        outro_start = n  # default: no outro

        # Find the last significant gap (if any) to refine outro start
        last_gap_boundary = None
        if gap_boundaries:
            # Only consider gaps after the last chorus
            for gb in reversed(gap_boundaries):
                if gb > last_chorus:
                    last_gap_boundary = gb
                    break

        for i in range(n - 1, last_chorus, -1):
            seg = segments[i]
            seg_dur = seg["end"] - seg["start"]
            if seg_dur / duration_sec <= OUTRO_MAX_DURATION_FRAC:
                outro_start = i
            else:
                break

        # If we found a gap boundary near the end, use it to tighten outro start
        if last_gap_boundary is not None:
            # Gap boundary is between seg[g] and seg[g+1]; outro should start
            # at g+1 (after the gap) or later
            gap_after = last_gap_boundary + 1
            if gap_after > outro_start:
                outro_start = gap_after

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


# ── Auxiliary analysis helpers ─────────────────────────────────────────────────


def _analyze_gaps(segments: list[dict], min_gap: float = MIN_GAP_FOR_BOUNDARY) -> list[int]:
    """Find segment indices where silence gaps indicate section boundaries.

    A gap is the difference between seg[i+1].start and seg[i].end.
    Returns indices i where gap >= min_gap seconds.
    """
    boundaries: list[int] = []
    for i in range(len(segments) - 1):
        gap = float(segments[i + 1]["start"]) - float(segments[i]["end"])
        if gap >= min_gap:
            boundaries.append(i)
    return boundaries


def _analyze_word_confidence(
    segments: list[dict],
    threshold: float = LOW_CONFIDENCE_THRESHOLD,
) -> list[int]:
    """Return indices of segments with low average word probability.

    Low-confidence segments are often musical interludes or spoken intros
    rather than clear vocals.
    """
    low_conf: list[int] = []
    for i, seg in enumerate(segments):
        words = seg.get("words")
        if not words:
            continue
        probs = [w.get("probability", 1.0) for w in words if isinstance(w, dict)]
        if probs and sum(probs) / len(probs) < threshold:
            low_conf.append(i)
    return low_conf


def _filter_chorus_by_duration(
    segments: list[dict],
    chorus_set: set[int],
    duration_sec: float,
) -> set[int]:
    """Apply duration-based constraints to chorus candidates.

    Rules:
      1. Chorus segments must not exceed 50% of total segments
         (many matching segments = likely false positive).
      2. Total chorus duration must be >= CHORUS_MIN_TOTAL_DURATION (3s).

    Returns filtered chorus set (or empty set if constraints fail).
    """
    if not chorus_set or duration_sec <= 0:
        return chorus_set

    sorted_idxs = sorted(chorus_set)
    n = len(segments)

    # Rule 1: chorus segments must not exceed 50% of total segments
    # Catches false positives where too many segments match each other
    if len(chorus_set) > n // 2:
        logger.debug(
            "chorus cluster contains %d/%d segments (> 50%%) — discarding",
            len(chorus_set), n,
        )
        return set()

    # Rule 2: total duration must be >= 3 seconds
    total_dur = sum(
        float(segments[i]["end"]) - float(segments[i]["start"])
        for i in sorted_idxs
    )
    if total_dur < CHORUS_MIN_TOTAL_DURATION:
        logger.debug("chorus cluster total duration %.1fs < %.0fs — discarding", total_dur, CHORUS_MIN_TOTAL_DURATION)
        return set()

    return chorus_set


# ── Label smoothing and constraints ────────────────────────────────────────────


def _smooth_labels(
    segments: list[dict[str, Any]],
    labels: list[str],
    chorus_set: set[int],
    duration_sec: float,
    n: int,
    gap_boundaries: list[int] | None = None,
    low_conf_segments: list[int] | None = None,
) -> list[str]:
    """Structural smoothing pass with bridge constraints and pattern validation.

    Rules applied:
      1. *Gap filling* — if a segment sits between two same-type segments
         and is **not** a ``chorus`` or ``bridge``, match the neighbours'
         type.
      2. *Bridge duration constraint* — very short bridges (< 3s) → verse.
      3. *Bridge same-type check* — if a bridge has the same section type
         on both sides (post-smoothing), reclassify to verse.
      4. *Bridge count limit* — cap total bridge blocks at MAX_BRIDGE_BLOCKS.
      5. *Structural pattern validation* — ensure typical pop patterns;
         if no chorus found, fall back to verse (except intro/outro).
      6. *Low-confidence segments* — segments with low word confidence
         between verses are reclassified as verse (not bridge/chorus).
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

    # ── 5c. Bridge duration constraint ─────────────────────────────────────
    for i in range(n):
        if new_labels[i] == "bridge":
            seg_dur = segments[i]["end"] - segments[i]["start"]
            if seg_dur < BRIDGE_MIN_DURATION:
                logger.debug(
                    "bridge at index %d too short (%.1fs < %.0fs) → verse",
                    i, seg_dur, BRIDGE_MIN_DURATION,
                )
                new_labels[i] = "verse"

    # ── 5d. Bridge same-type check ─────────────────────────────────────────
    # After gap-filling, check if a bridge has the same *non-chorus* type on
    # both sides.  [chorus] [bridge] [chorus] is *legitimate* — bridges
    # traditionally sit between choruses.  But [verse] [bridge] [verse] is
    # suspicious (bridge should connect different section types).
    if n >= 3:
        for i in range(1, n - 1):
            if new_labels[i] == "bridge":
                left = new_labels[i - 1]
                right = new_labels[i + 1]
                # Same non-chorus, non-bridge type on both sides → not a bridge
                if left == right and left not in ("chorus", "bridge"):
                    logger.debug(
                        "bridge at index %d has same type '%s' on both sides → verse",
                        i, left,
                    )
                    new_labels[i] = "verse"

    # ── 5e. Bridge count limit ─────────────────────────────────────────────
    # Count contiguous bridge blocks; demote excess bridges to verse
    bridge_blocks: list[list[int]] = []
    current_block: list[int] = []
    for i in range(n):
        if new_labels[i] == "bridge":
            current_block.append(i)
        else:
            if current_block:
                bridge_blocks.append(current_block)
                current_block = []
    if current_block:
        bridge_blocks.append(current_block)

    if len(bridge_blocks) > MAX_BRIDGE_BLOCKS:
        # Demote the SHORTEST bridges first (keep the longest, most significant)
        block_durations: list[float] = []
        for block in bridge_blocks:
            dur = sum(segments[idx]["end"] - segments[idx]["start"] for idx in block)
            block_durations.append(dur)

        # Sort blocks by duration ascending so shortest get demoted first
        sorted_pairs = sorted(
            zip(bridge_blocks, block_durations),
            key=lambda x: x[1],
        )

        excess_count = len(bridge_blocks) - MAX_BRIDGE_BLOCKS
        for block, dur in sorted_pairs[:excess_count]:
            for idx in block:
                logger.debug(
                    "excess bridge block at indices %s (dur=%.1fs) → verse",
                    block, dur,
                )
                new_labels[idx] = "verse"

    # Also demote suspiciously long bridges (>30s — real pop bridges are 8-20s)
    for i in range(n):
        if new_labels[i] == "bridge":
            dur = segments[i]["end"] - segments[i]["start"]
            if dur > 30.0:
                logger.debug(
                    "bridge at index %d too long (%.1fs > 30s) → verse",
                    i, dur,
                )
                new_labels[i] = "verse"

    # ── 5f. Low-confidence segments: demote to verse ───────────────────────
    # Segments with low word confidence that got labelled as chorus/bridge
    # are likely instrumental sections — keep as verse.
    if low_conf_segments:
        for i in low_conf_segments:
            if new_labels[i] in ("chorus", "bridge"):
                logger.debug(
                    "low-confidence segment %d (label=%s) → verse",
                    i, new_labels[i],
                )
                new_labels[i] = "verse"

    # ── 5g. No-chorus fallback ─────────────────────────────────────────────
    if not chorus_set:
        for i in range(n):
            if new_labels[i] not in ("intro", "outro"):
                new_labels[i] = "verse"

    # ── 5h. Structural pattern validation ──────────────────────────────────
    # Ensure that verses between choruses stay as verses
    # (gap-filling already preserves chorus/bridge, but double-check)
    if chorus_set and n >= 3:
        for i in range(1, n - 1):
            if (
                new_labels[i - 1] == "chorus"
                and new_labels[i + 1] == "chorus"
                and new_labels[i] not in ("chorus", "bridge")
            ):
                # A verse between two choruses should remain verse
                if new_labels[i] != "verse":
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


# ── Sentence-level segment splitting ──────────────────────────────────────────


def _split_text_by_sentences(text: str) -> list[str]:
    """Split text into sentences. Uses multiple strategies in order.
    
    Strategy 1: Split on . ! ? followed by space.
    Strategy 2: Split on line breaks (\\n).
    Strategy 3: Fallback - split by word chunks (~15-20 words).
    """
    if not text or not text.strip():
        return []

    text = text.strip()

    # Strategy 1: Split on . ! ? followed by space
    parts = re.split(r'(?<=[.!?])\s+', text)
    parts = [p.strip() for p in parts if p.strip()]

    # Strategy 2: Split on newlines
    if len(parts) <= 1 and '\n' in text:
        parts = [p.strip() for p in text.split('\n') if p.strip()]

    # Strategy 3: Fallback - split by word chunks
    if len(parts) <= 1:
        words = text.split()
        chunk_size = 15  # target words per chunk
        parts = []
        for i in range(0, len(words), chunk_size):
            chunk = ' '.join(words[i:i + chunk_size])
            if chunk.strip():
                parts.append(chunk.strip())

    return parts


def _split_segment_with_words(seg: dict) -> list[dict]:
    """Split a segment that has word-level timestamps."""
    text = seg.get('text', '')
    words = seg.get('words', [])

    if not text or not words:
        return [dict(seg)]

    sentences = _split_text_by_sentences(text)
    if len(sentences) <= 1:
        return [dict(seg)]

    # Map each sentence to word indices
    result = []
    word_idx = 0
    sent_char_pos = 0

    for sentence in sentences:
        if not sentence:
            continue

        # Walk words until we accumulate enough characters for this sentence
        sentence_words = []
        sent_char_pos = 0

        while word_idx < len(words) and sent_char_pos < len(sentence):
            word = words[word_idx]
            word_text = word.get('word', '')
            sentence_words.append(word)
            sent_char_pos += len(word_text) + 1  # +1 for space
            word_idx += 1

        if sentence_words:
            result.append({
                'start': sentence_words[0].get('start', seg['start']),
                'end': sentence_words[-1].get('end', seg['end']),
                'text': sentence.strip(),
                'words': list(sentence_words),
            })

    return result if result else [dict(seg)]


def _split_segment_without_words(seg: dict) -> list[dict]:
    """Split a segment without word timestamps - distribute time proportionally.
    
    Uses word count for proportional distribution (more accurate than char count).
    """
    text = seg.get('text', '')
    if not text:
        return [dict(seg)]

    sentences = _split_text_by_sentences(text)
    if len(sentences) <= 1:
        return [dict(seg)]

    start = seg['start']
    end = seg['end']
    duration = end - start

    # Use word count for proportional distribution (more accurate than char count)
    word_counts = [len(s.strip().split()) for s in sentences]
    total_words = sum(word_counts)

    result = []
    current_start = start

    for i, sentence in enumerate(sentences):
        proportion = word_counts[i] / max(total_words, 1)
        sentence_duration = duration * proportion
        current_end = current_start + sentence_duration

        # Round to 2 decimals
        result.append({
            'start': round(current_start, 2),
            'end': round(current_end, 2),
            'text': sentence,
        })
        current_start = current_end

    return result


def _join_short_segments(segments: list[dict], min_duration: float = 2.0) -> list[dict]:
    """Join consecutive short segments."""
    if not segments:
        return segments

    result = [dict(segments[0])]
    for seg in segments[1:]:
        last = result[-1]
        last_dur = last['end'] - last['start']

        if last_dur < min_duration:
            # Join
            last['end'] = seg['end']
            last_text = str(last.get('text', ''))
            seg_text = str(seg.get('text', ''))
            if last_text and seg_text:
                last['text'] = last_text + ' ' + seg_text
            elif seg_text:
                last['text'] = seg_text

            # Merge words
            last_words = last.get('words') or []
            seg_words = seg.get('words') or []
            if seg_words:
                last['words'] = last_words + seg_words
        else:
            result.append(dict(seg))

    return result


def split_segments_by_sentences(
    segments: list[dict],
    join_short: bool = True,
    min_duration: float = 2.0,
) -> list[dict]:
    """
    Splits each segment at sentence boundaries using word-level timestamps.

    If words list is available:
        - Split text at sentence endings (.!?)
        - Map each sentence to its word-level timestamps
        - Create new segment for each sentence with correct start/end

    If words list is NOT available:
        - Split text at sentence endings
        - Distribute the segment's time proportionally by character count

    Args:
        segments: list of dicts with {start, end, text, words?}
        join_short: if True, consecutive short segments (< min_duration) are joined
        min_duration: minimum segment duration in seconds

    Returns:
        list of dicts with {start, end, text, words?}
    """
    if not segments:
        return []

    result = []
    for seg in segments:
        words = seg.get('words')
        if words:
            sub = _split_segment_with_words(seg)
        else:
            sub = _split_segment_without_words(seg)
        result.extend(sub)

    if join_short:
        result = _join_short_segments(result, min_duration)

    return result
