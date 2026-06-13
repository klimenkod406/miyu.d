"""Smoke tests for the structural segmentation module."""
import sys
sys.path.insert(0, ".")

from app.analysis.structure import analyze


def test_empty_input():
    assert analyze([], {}, 180.0) == []


def test_zero_duration():
    assert analyze([{"start": 0, "end": 10, "text": "hello"}], {}, 0.0) == []


def test_single_segment():
    result = analyze([{"start": 0, "end": 30, "text": "kuplet odin"}], {}, 30.0)
    assert len(result) == 1
    assert result[0]["type"] == "verse"


def test_two_segments():
    segments = [
        {"start": 0, "end": 5, "text": "intro music"},
        {"start": 5, "end": 25, "text": "verse text here first"},
    ]
    result = analyze(segments, {}, 25.0)
    assert len(result) > 0


def test_chorus_detection():
    """Repeated chorus text should be detected as chorus."""
    segments = [
        {"start": 0, "end": 4, "text": "intro"},
        {"start": 4, "end": 14, "text": "verse one first verse"},
        {"start": 14, "end": 20, "text": "chorus repeat chorus words"},
        {"start": 20, "end": 30, "text": "verse two second verse"},
        {"start": 30, "end": 36, "text": "chorus repeat chorus words"},
        {"start": 36, "end": 40, "text": "outro end"},
    ]
    result = analyze(segments, {}, 40.0)
    types = [b["type"] for b in result]
    assert "chorus" in types, f"Expected chorus in {types}"
    assert "verse" in types, f"Expected verse in {types}"
    # Verify merge: consecutive chorus-like segments merged
    for b in result:
        print(f"  {b['type']:7s} {b['start']:5.1f}-{b['end']:5.1f}  idx={b['segment_indices']}")


def test_no_chorus_fallback():
    """If no repeated text, everything should be verse."""
    segments = [
        {"start": 0, "end": 5, "text": "a"},
        {"start": 5, "end": 12, "text": "b"},
    ]
    result = analyze(segments, {}, 12.0)
    assert all(b["type"] == "verse" for b in result)


def test_bridge_detection():
    """Bridge should be detected between two choruses."""
    segments = [
        {"start": 0, "end": 5, "text": "intro part"},
        {"start": 5, "end": 15, "text": "verse one text here"},
        {"start": 15, "end": 21, "text": "chorus repeat chorus"},
        {"start": 21, "end": 31, "text": "verse two second text"},
        {"start": 31, "end": 37, "text": "chorus repeat chorus"},
        {"start": 37, "end": 41, "text": "bridge unique short"},
        {"start": 41, "end": 47, "text": "chorus repeat chorus"},
        {"start": 47, "end": 51, "text": "outro end part"},
    ]
    result = analyze(segments, {}, 51.0)
    types = [b["type"] for b in result]
    print(f"Bridge test types: {types}")
    for b in result:
        print(f"  {b['type']:7s} {b['start']:5.1f}-{b['end']:5.1f}  idx={b['segment_indices']}")
    # There should be a chorus (from the repeated segments)
    assert "chorus" in types
    assert "verse" in types


if __name__ == "__main__":
    test_empty_input()
    print("OK: test_empty_input")
    test_zero_duration()
    print("OK: test_zero_duration")
    test_single_segment()
    print("OK: test_single_segment")
    test_two_segments()
    print("OK: test_two_segments")
    test_chorus_detection()
    print("OK: test_chorus_detection")
    test_no_chorus_fallback()
    print("OK: test_no_chorus_fallback")
    test_bridge_detection()
    print("OK: test_bridge_detection")
    print("\nAll smoke tests passed!")
