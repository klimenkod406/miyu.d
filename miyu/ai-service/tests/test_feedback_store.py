from __future__ import annotations

from app.recsys import feedback_store


def test_score_to_signal_maps_negative_scores():
    assert feedback_store._score_to_signal(-2) == "hide"
    assert feedback_store._score_to_signal(-1) == "dislike"


def test_score_to_signal_skips_positive_feedback_for_legacy_signal_schema():
    assert feedback_store._score_to_signal(1) is None
