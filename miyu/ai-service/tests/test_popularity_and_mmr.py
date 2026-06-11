"""Контрольные тесты для popularity.hn_score и reranker.mmr_select."""
from __future__ import annotations

import numpy as np
import pytest

from app.recsys import popularity, reranker


# --- HN-score --------------------------------------------------------------

def test_hn_score_zero_plays_is_zero():
    assert popularity.hn_score(0, 1.0) == 0.0
    assert popularity.hn_score(-5, 1.0) == 0.0


def test_hn_score_one_play_is_zero():
    """plays-1 = 0 — 1 плей не должен поднимать трек."""
    assert popularity.hn_score(1, 0.0) == pytest.approx(0.0)


def test_hn_score_decreases_with_age():
    fresh = popularity.hn_score(100, 1.0)
    old = popularity.hn_score(100, 100.0)
    assert fresh > old > 0


def test_hn_score_increases_with_plays():
    a = popularity.hn_score(10, 5.0)
    b = popularity.hn_score(100, 5.0)
    assert b > a


def test_hn_score_negative_age_clamped():
    """Часы из будущего не должны приводить к делению на ноль/буст."""
    s_future = popularity.hn_score(100, -10.0)
    s_now = popularity.hn_score(100, 0.0)
    assert s_future == pytest.approx(s_now)


def test_hn_score_gravity_param():
    """Большая gravity сильнее штрафует возраст."""
    g_low = popularity.hn_score(100, 24.0, gravity=1.0)
    g_high = popularity.hn_score(100, 24.0, gravity=2.5)
    assert g_low > g_high


# --- MMR -------------------------------------------------------------------

def _emb(*vec) -> np.ndarray:
    return np.array(vec, dtype=np.float32)


def test_mmr_returns_top_when_lambda_one():
    """λ=1 → MMR = top-K по релевантности."""
    cands = [(1, 1.0), (2, 0.8), (3, 0.5)]
    embs = {1: _emb(1, 0), 2: _emb(0, 1), 3: _emb(1, 1)}
    out = reranker.mmr_select(cands, embs, limit=2, lambda_diversity=1.0, max_per_artist=None)
    assert [tid for tid, _ in out] == [1, 2]


def test_mmr_picks_diverse_when_lambda_low():
    """Кандидаты 1 и 2 идентичны; 3 ортогонален. λ=0 (только diversity)
    должен выбрать 1 (первый), затем 3 (наиболее далёкий)."""
    cands = [(1, 0.9), (2, 0.89), (3, 0.5)]
    embs = {
        1: _emb(1, 0),
        2: _emb(1, 0),  # Дубликат 1.
        3: _emb(0, 1),  # Ортогонален.
    }
    out = reranker.mmr_select(cands, embs, limit=2, lambda_diversity=0.0, max_per_artist=None)
    assert [tid for tid, _ in out] == [1, 3]


def test_mmr_respects_max_per_artist():
    """Лимит 1 трек на артиста — даже если у артиста много кандидатов."""
    cands = [(1, 1.0), (2, 0.9), (3, 0.8)]
    embs = {1: _emb(1, 0), 2: _emb(1, 0), 3: _emb(0, 1)}
    artist_of = {1: 100, 2: 100, 3: 200}  # 1 и 2 одного артиста
    out = reranker.mmr_select(
        cands, embs, limit=3, lambda_diversity=1.0,
        max_per_artist=1, artist_of=artist_of,
    )
    assert sorted(tid for tid, _ in out) == [1, 3]


def test_mmr_empty_candidates():
    assert reranker.mmr_select([], {}, limit=10) == []


def test_mmr_handles_missing_embeddings():
    """Без эмбеддинга — penalty=0, кандидат не штрафуется за 'похожесть'."""
    cands = [(1, 1.0), (2, 0.9)]
    embs = {1: _emb(1, 0)}  # У 2 нет эмбеддинга.
    out = reranker.mmr_select(cands, embs, limit=2, lambda_diversity=0.5, max_per_artist=None)
    assert sorted(tid for tid, _ in out) == [1, 2]


# --- filters ---------------------------------------------------------------

def test_filter_listened_today_removes_set():
    cands = [(1, 1.0), (2, 0.9), (3, 0.8)]
    out = reranker.filter_listened_today(cands, [2])
    assert [tid for tid, _ in out] == [1, 3]


def test_filter_dislikes_removes_set():
    cands = [(1, 1.0), (2, 0.9), (3, 0.8)]
    out = reranker.filter_explicit_dislikes(cands, [1, 3])
    assert [tid for tid, _ in out] == [2]


def test_filter_seen_items_removes_known_tracks():
    cands = [(1, 1.0), (2, 0.9), (3, 0.8)]
    out = reranker.filter_seen_items(cands, [2, 3])
    assert [tid for tid, _ in out] == [1]


def test_filter_blocked_artists_removes_artist_tracks():
    cands = [(1, 1.0), (2, 0.9), (3, 0.8)]
    artist_of = {1: 10, 2: 20, 3: 20}
    out = reranker.filter_blocked_artists(cands, artist_of, [20])
    assert [tid for tid, _ in out] == [1]


def test_dedupe_keep_best_keeps_highest_score():
    cands = [(1, 0.3), (2, 0.5), (1, 0.8), (3, 0.1)]
    out = reranker.dedupe_keep_best(cands)
    assert out == [(1, 0.8), (2, 0.5), (3, 0.1)]
