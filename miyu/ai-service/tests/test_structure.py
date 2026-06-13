"""Comprehensive tests for the structural segmentation module.

Covers input validation, chorus detection, bridge detection, pop-song pattern,
intro/outro boundary logic, short tracks, and non-repetition fallback.
All tests use synthetic segment data — no audio files.
"""

from app.analysis.structure import analyze


# ── Helper ──────────────────────────────────────────────────────────────────


def make_segment(start: float, end: float, text: str) -> dict:
    """Build a synthetic Whisper-style segment dict."""
    return {"start": start, "end": end, "text": text}


# ── Tests ───────────────────────────────────────────────────────────────────


def test_empty_segments():
    """Empty segments list → empty result regardless of duration."""
    assert analyze([], None, 30.0) == []
    assert analyze([], {}, 30.0) == []


def test_zero_duration():
    """Zero or negative duration → empty result."""
    assert analyze([make_segment(0, 10, "hello")], {}, 0.0) == []
    assert analyze([make_segment(0, 10, "hello")], {}, -1.0) == []


def test_single_segment():
    """Single segment returns exactly one verse block."""
    result = analyze([make_segment(0, 30, "a song verse")], {}, 30.0)
    assert len(result) == 1
    assert result[0]["type"] == "verse"
    assert result[0]["label"] == "Куплет"
    assert result[0]["start"] == 0.0
    assert result[0]["end"] == 30.0
    assert result[0]["segment_indices"] == [0]


def test_chorus_detection():
    """Repeated text across non-adjacent segments is detected as chorus.

    Pattern: intro(short) → verse1 → chorus → verse2 → chorus → outro(short)
    Segments 2 and 4 (0-indexed) carry identical text.
    """
    segments = [
        make_segment(0, 3, "intro"),
        make_segment(3, 13, "verse one text here"),
        make_segment(13, 19, "chorus repeat chorus words"),
        make_segment(19, 29, "verse two second verse"),
        make_segment(29, 35, "chorus repeat chorus words"),
        make_segment(35, 38, "outro end"),
    ]
    result = analyze(segments, {}, 38.0)
    types = [b["type"] for b in result]

    assert "chorus" in types, f"Expected chorus in {types}"
    assert "verse" in types, f"Expected verse in {types}"

    # First block should be intro (short first segment within thresholds)
    assert result[0]["type"] == "intro"

    # Last block should be outro (short segment after last chorus)
    assert result[-1]["type"] == "outro"

    # At least four distinct structural parts
    assert len(result) >= 4


def test_no_repetition():
    """All-unique text → no chorus; every block is verse (except intro/outro)."""
    segments = [
        make_segment(0, 4, "intro part one"),
        make_segment(4, 14, "first verse unique text"),
        make_segment(14, 24, "second verse different"),
        make_segment(24, 34, "third verse nothing same"),
    ]
    result = analyze(segments, {}, 34.0)
    types = [b["type"] for b in result]

    assert "chorus" not in types, f"Unexpected chorus in {types}"

    # Every non-intro / non-outro block must be a verse
    for b in result:
        if b["type"] not in ("intro", "outro"):
            assert b["type"] == "verse", f"Unexpected block type {b['type']}"


def test_structure_pattern_pop():
    """Full pop-song pattern: intro → verse → chorus → verse → chorus
    → bridge → chorus → outro.

    Bridge sits between two chorus occurrences and is shorter than the
    nearest verses.
    """
    segments = [
        make_segment(0, 3, "intro part"),
        make_segment(3, 13, "verse one text here"),
        make_segment(13, 19, "chorus repeat chorus"),
        make_segment(19, 29, "verse two second verse"),
        make_segment(29, 35, "chorus repeat chorus"),
        make_segment(35, 39, "bridge unique short"),
        make_segment(39, 45, "chorus repeat chorus"),
        make_segment(45, 48, "outro end part"),
    ]
    result = analyze(segments, {}, 48.0)
    types = [b["type"] for b in result]

    assert "intro" in types, f"Expected intro in {types}"
    assert "verse" in types, f"Expected verse in {types}"
    assert "chorus" in types, f"Expected chorus in {types}"
    assert "bridge" in types, f"Expected bridge in {types}"
    assert "outro" in types, f"Expected outro in {types}"

    # Bridge must appear between two chorus blocks
    bridge_idx = next(i for i, b in enumerate(result) if b["type"] == "bridge")
    assert 0 < bridge_idx < len(result) - 1
    assert result[bridge_idx - 1]["type"] == "chorus", (
        f"Block before bridge should be chorus, got {result[bridge_idx - 1]['type']}"
    )
    assert result[bridge_idx + 1]["type"] == "chorus", (
        f"Block after bridge should be chorus, got {result[bridge_idx + 1]['type']}"
    )


def test_short_track():
    """Segments totalling less than 30 seconds → valid structure, no crash."""
    segments = [
        make_segment(0, 3, "short intro"),
        make_segment(3, 10, "short verse one"),
        make_segment(10, 16, "short chorus text"),
        make_segment(16, 20, "short chorus text"),
    ]
    result = analyze(segments, {}, 20.0)
    assert len(result) > 0, "Expected non-empty result for short track"
    # Every block must have the required output keys
    for b in result:
        assert "type" in b
        assert "label" in b
        assert "start" in b
        assert "end" in b
        assert "segment_indices" in b


def test_intro_outro_boundaries():
    """Intro/outro correctly identified via duration-fraction thresholds.

    Intro: first segment short (< 15 % duration, < 40 chars).
    Outro: segment after last chorus and short (< 10 % duration).
    """
    segments = [
        make_segment(0, 2, "intro text"),
        make_segment(2, 12, "verse one the first verse here"),
        make_segment(12, 18, "chorus words repeated"),
        make_segment(18, 28, "verse two the second verse text"),
        make_segment(28, 34, "chorus words repeated"),
        make_segment(34, 36, "outro text example"),
    ]
    result = analyze(segments, {}, 36.0)
    types = [b["type"] for b in result]

    assert types[0] == "intro", f"First block should be intro, got {types}"
    assert types[-1] == "outro", f"Last block should be outro, got {types}"

    # Intro block must contain the first segment
    assert 0 in result[0]["segment_indices"]

    # Outro block must contain the last segment
    assert result[-1]["segment_indices"] == [5]


def test_segment_without_text_key():
    """Segments missing the 'text' key should be handled gracefully."""
    segments = [
        {"start": 0, "end": 5},  # no 'text'
        make_segment(5, 15, "verse with text"),
        make_segment(15, 25, "another verse"),
    ]
    result = analyze(segments, {}, 25.0)
    # Should not crash; empty text is treated as empty string
    assert len(result) > 0
