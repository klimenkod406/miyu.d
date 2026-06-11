"""Контрольные тесты для recsys/profile.py — формула весов, decay, центроид.

Эти тесты не требуют БД и Redis: проверяют чистые функции.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

from app.recsys import profile


NOW = datetime(2026, 4, 27, 12, 0, tzinfo=timezone.utc)


def _ago(days: float) -> str:
    return (NOW - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")


# --- time_decay -------------------------------------------------------------

def test_time_decay_fresh_event_is_one():
    assert profile.time_decay(NOW, NOW) == pytest.approx(1.0)


def test_time_decay_half_life_is_30_days():
    dt = NOW - timedelta(days=30)
    assert profile.time_decay(dt, NOW) == pytest.approx(0.5, rel=1e-6)


def test_time_decay_two_half_lives():
    dt = NOW - timedelta(days=60)
    assert profile.time_decay(dt, NOW) == pytest.approx(0.25, rel=1e-6)


def test_time_decay_unknown_dt_is_one():
    assert profile.time_decay(None, NOW) == 1.0


def test_time_decay_future_event_is_one():
    """Защита от часов вперёд — отрицательный возраст не должен «бустить» вес."""
    dt = NOW + timedelta(days=10)
    assert profile.time_decay(dt, NOW) == pytest.approx(1.0)


# --- aggregate_signals: формула весов --------------------------------------

def test_like_weight_is_three():
    sigs = profile.aggregate_signals(likes=[(1, _ago(0))], now=NOW)
    assert sigs[1].weight == pytest.approx(3.0)
    assert sigs[1].raw_events == 1


def test_completed_play_weight_is_one():
    sigs = profile.aggregate_signals(plays_completed=[(1, _ago(0))], now=NOW)
    assert sigs[1].weight == pytest.approx(1.0)


def test_partial_play_weight_is_03():
    sigs = profile.aggregate_signals(plays_partial=[(1, _ago(0))], now=NOW)
    assert sigs[1].weight == pytest.approx(0.3)


def test_explicit_dislike_negative():
    sigs = profile.aggregate_signals(explicit_dislikes=[(1, _ago(0))], now=NOW)
    assert sigs[1].weight == pytest.approx(-1.5)


def test_early_skip_negative():
    sigs = profile.aggregate_signals(early_skips=[(1, _ago(0))], now=NOW)
    assert sigs[1].weight == pytest.approx(-0.8)


def test_signals_combine_per_track():
    """1 like + 3 completed plays = 3.0 + 3*1.0 = 6.0 (свежие)."""
    sigs = profile.aggregate_signals(
        likes=[(1, _ago(0))],
        plays_completed=[(1, _ago(0))] * 3,
        now=NOW,
    )
    assert sigs[1].weight == pytest.approx(6.0)
    assert sigs[1].raw_events == 4


def test_decay_applied_to_weight():
    """Свежий лайк = 3.0; лайк 30 дней назад = 1.5."""
    sigs = profile.aggregate_signals(likes=[(1, _ago(30))], now=NOW)
    assert sigs[1].weight == pytest.approx(1.5, rel=1e-6)


def test_independent_tracks_dont_mix():
    sigs = profile.aggregate_signals(
        likes=[(1, _ago(0)), (2, _ago(0))],
        plays_completed=[(2, _ago(0))],
        now=NOW,
    )
    assert sigs[1].weight == pytest.approx(3.0)
    assert sigs[2].weight == pytest.approx(4.0)


def test_full_formula_sample():
    """Проверяем, что все 9 каналов суммируются как в spec."""
    sigs = profile.aggregate_signals(
        likes=[(1, _ago(0))],
        playlists=[(1, _ago(0))],
        follows_artist_tracks=[(1, _ago(0))],
        plays_completed=[(1, _ago(0))],
        plays_partial=[(1, _ago(0))],
        videos_completed=[(1, _ago(0))],
        videos_partial=[(1, _ago(0))],
        explicit_dislikes=[(1, _ago(0))],
        early_skips=[(1, _ago(0))],
        now=NOW,
    )
    expected = 3.0 + 2.0 + 1.5 + 1.0 + 0.3 + 1.0 + 0.3 - 1.5 - 0.8
    assert sigs[1].weight == pytest.approx(expected, rel=1e-6)


# --- compute_centroid -------------------------------------------------------

def test_centroid_with_one_track_equals_its_embedding():
    sigs = {1: profile.TrackSignal(weight=2.0, raw_events=1)}
    embs = {1: np.array([1.0, 0.0, 0.0], dtype=np.float32)}
    centroid, diversity = profile.compute_centroid(sigs, embs)
    assert centroid is not None
    np.testing.assert_allclose(centroid, [1.0, 0.0, 0.0], rtol=1e-6)
    # Один трек: cosine с центроидом = 1, distance = 0.
    assert diversity == pytest.approx(0.0, abs=1e-6)


def test_centroid_weighted_average():
    """Веса 1 и 3 → центроид сильнее тянет ко второму вектору."""
    sigs = {
        1: profile.TrackSignal(weight=1.0, raw_events=1),
        2: profile.TrackSignal(weight=3.0, raw_events=1),
    }
    embs = {
        1: np.array([1.0, 0.0], dtype=np.float32),
        2: np.array([0.0, 1.0], dtype=np.float32),
    }
    centroid, _ = profile.compute_centroid(sigs, embs)
    np.testing.assert_allclose(centroid, [0.25, 0.75], rtol=1e-6)


def test_centroid_skips_negative_weights():
    """Дизлайки не должны попадать в центроид (только w>0)."""
    sigs = {
        1: profile.TrackSignal(weight=2.0, raw_events=1),
        2: profile.TrackSignal(weight=-1.5, raw_events=1),  # skip
    }
    embs = {
        1: np.array([1.0, 0.0], dtype=np.float32),
        2: np.array([0.0, 1.0], dtype=np.float32),
    }
    centroid, _ = profile.compute_centroid(sigs, embs)
    np.testing.assert_allclose(centroid, [1.0, 0.0], rtol=1e-6)


def test_centroid_empty_returns_none():
    centroid, diversity = profile.compute_centroid({}, {})
    assert centroid is None
    assert diversity == 0.0


def test_centroid_all_negative_returns_none():
    sigs = {1: profile.TrackSignal(weight=-1.0, raw_events=1)}
    embs = {1: np.array([1.0, 0.0], dtype=np.float32)}
    centroid, _ = profile.compute_centroid(sigs, embs)
    assert centroid is None


def test_diversity_higher_for_orthogonal_tracks():
    """Два равновесных ортогональных трека → diversity ~ 0.5."""
    sigs = {
        1: profile.TrackSignal(weight=1.0, raw_events=1),
        2: profile.TrackSignal(weight=1.0, raw_events=1),
    }
    embs = {
        1: np.array([1.0, 0.0], dtype=np.float32),
        2: np.array([0.0, 1.0], dtype=np.float32),
    }
    _, diversity = profile.compute_centroid(sigs, embs)
    # cosine двух треков с центроидом (0.5, 0.5)/||.|| = 1/√2; distance = 1 - 1/√2 ≈ 0.293
    assert diversity == pytest.approx(1 - 1 / np.sqrt(2), rel=1e-4)


def test_top_positive_track_ids_orders_by_weight_then_events():
    sigs = {
        1: profile.TrackSignal(weight=2.0, raw_events=1),
        2: profile.TrackSignal(weight=4.0, raw_events=1),
        3: profile.TrackSignal(weight=4.0, raw_events=3),
        4: profile.TrackSignal(weight=-1.0, raw_events=10),
    }
    assert profile.top_positive_track_ids(sigs, limit=3) == [3, 2, 1]
