"""Юнит-тесты на агрегатор: правила score/flags/decision."""
from __future__ import annotations

from app.analysis.aggregator import ModerationSignals, aggregate
from app.config import get_settings


def test_clean_track_auto_approves():
    s = ModerationSignals(toxicity={"toxicity": 0.05}, artist_is_verified=True)
    d = aggregate(s)
    assert d.decision == "approve"
    assert d.ai_score < 0.2
    assert "hate" not in d.ai_flags


def test_high_toxicity_flags_as_hate():
    s = ModerationSignals(
        toxicity={"toxicity": 0.95, "severe_toxicity": 0.9, "identity_attack": 0.8, "threat": 0.2},
        artist_is_verified=True,
    )
    d = aggregate(s)
    assert "hate" in d.ai_flags
    assert d.decision == "flag"


def test_invalid_audio_is_red_flag():
    s = ModerationSignals(invalid_audio=True, artist_is_verified=True)
    d = aggregate(s)
    assert "invalid_audio" in d.ai_flags
    assert d.decision == "flag"
    assert d.ai_score >= 0.9


def test_nsfw_cover_high_flags():
    s = ModerationSignals(nsfw_cover=0.85, artist_is_verified=True)
    d = aggregate(s)
    assert "nsfw_cover" in d.ai_flags
    assert d.decision == "flag"


def test_nsfw_cover_borderline_pending():
    s = ModerationSignals(nsfw_cover=0.4, artist_is_verified=True)
    d = aggregate(s)
    assert "suggestive_cover" in d.ai_flags
    assert d.decision in {"pending", "approve"}  # не red-flag


def test_duplicate_flagged():
    s = ModerationSignals(possible_duplicate=True, duplicate_score=0.96, artist_is_verified=True)
    d = aggregate(s)
    assert "possible_duplicate" in d.ai_flags
    assert d.decision == "flag"


def test_unverified_artist_penalty():
    cfg = get_settings()
    s_v = ModerationSignals(toxicity={"toxicity": 0.1}, artist_is_verified=True)
    s_u = ModerationSignals(toxicity={"toxicity": 0.1}, artist_is_verified=False)
    d_v = aggregate(s_v)
    d_u = aggregate(s_u)
    assert d_u.ai_score - d_v.ai_score == round(cfg.unverified_artist_penalty, 4)


def test_explicit_lyrics_does_not_block_alone():
    s = ModerationSignals(is_explicit=True, artist_is_verified=True)
    d = aggregate(s)
    assert "explicit_lyrics" in d.ai_flags
    # explicit сам по себе — не red-flag
    assert d.decision != "flag"
