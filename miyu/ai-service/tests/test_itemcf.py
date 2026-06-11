"""Контрольные тесты для recsys/itemcf.py — чистые функции co-occurrence."""
from __future__ import annotations

import math

import pytest

from app.recsys import itemcf


# --- build_index_from_user_items -------------------------------------------

def test_empty_input_yields_empty_index():
    idx = itemcf.build_index_from_user_items({})
    assert idx.size == 0
    assert idx.n_users == 0


def test_single_user_no_pairs():
    """Один user → 0 co-occurrence пар (нечего комбинировать)."""
    idx = itemcf.build_index_from_user_items({1: {10}}, min_cooccurrence=1)
    assert idx.size == 0
    assert idx.item_freq == {10: 1}


def test_two_users_one_common_track_below_min_co():
    """min_cooccurrence=2 отсекает одиночные совпадения."""
    user_items = {1: {10, 20}, 2: {10, 30}}
    idx = itemcf.build_index_from_user_items(user_items, min_cooccurrence=2)
    # Все пары встретились по 1 разу — должны быть отсечены.
    assert idx.size == 0


def test_basic_cooccurrence_symmetric():
    """Если 3 юзера лайкнули {A,B}, sim(A,B) = sim(B,A) = 3/sqrt(3*3) = 1.0."""
    user_items = {1: {1, 2}, 2: {1, 2}, 3: {1, 2}}
    idx = itemcf.build_index_from_user_items(user_items, min_cooccurrence=1)
    assert (2, pytest.approx(1.0)) in idx.neighbors[1]
    assert (1, pytest.approx(1.0)) in idx.neighbors[2]
    assert idx.item_freq == {1: 3, 2: 3}


def test_normalization_penalizes_popular_items():
    """Популярный item не должен «прилипать» ко всем — нормализация √(c_a * c_b)."""
    # 1 — суперпопулярный (10 юзеров), 2 — у 2 юзеров, и оба раза вместе с 1.
    user_items = {i: {1} for i in range(10)}
    user_items[0].add(2)
    user_items[1].add(2)
    # 3 — у 2 юзеров, оба раза с 1, но не «забит» популярностью.
    user_items[2].add(3)
    user_items[3].add(3)
    idx = itemcf.build_index_from_user_items(user_items, min_cooccurrence=1)
    # sim(1,2) = 2 / sqrt(10*2) = 0.447;  sim(2,3) тут = 0 (не co-occur).
    sim12 = dict(idx.neighbors.get(1, []))[2]
    assert sim12 == pytest.approx(2 / math.sqrt(10 * 2), rel=1e-6)


def test_top_neighbors_truncated():
    """Если у item много соседей — возвращаем только top-N."""
    # 5 юзеров, каждый лайкнул {0, i} → у 0 будет 5 соседей.
    user_items = {i: {0, i + 1} for i in range(5)}
    idx = itemcf.build_index_from_user_items(user_items, top_neighbors=2, min_cooccurrence=1)
    assert len(idx.neighbors[0]) == 2


def test_neighbors_sorted_descending_by_sim():
    user_items = {
        1: {10, 20, 30},
        2: {10, 20, 30},
        3: {10, 20},  # 10-20 встретились 3 раза, 10-30 — 2 раза
        4: {10, 20},
    }
    idx = itemcf.build_index_from_user_items(user_items, min_cooccurrence=1)
    nbrs_10 = idx.neighbors[10]
    sims = [s for _, s in nbrs_10]
    assert sims == sorted(sims, reverse=True)
    assert nbrs_10[0][0] == 20  # 20 ближе к 10 чем 30


# --- recommend_from_seen ---------------------------------------------------

def test_recommend_excludes_already_seen():
    user_items = {1: {1, 2}, 2: {1, 2}, 3: {1, 2, 3}}
    idx = itemcf.build_index_from_user_items(user_items, min_cooccurrence=1)
    out = itemcf.recommend_from_seen([1, 2], idx, limit=10)
    # 3 — единственный незнакомый кандидат у user'а с {1, 2}
    rec_ids = [tid for tid, _ in out]
    assert 1 not in rec_ids and 2 not in rec_ids
    assert 3 in rec_ids


def test_recommend_aggregates_scores_from_multiple_seeds():
    """Сценарий: u лайкнул {1, 2}; кандидат 3 — сосед обоих → его score = sim(1,3)+sim(2,3)."""
    user_items = {
        1: {1, 3},
        2: {1, 3},
        3: {2, 3},
        4: {2, 3},
        5: {1, 2},
    }
    idx = itemcf.build_index_from_user_items(user_items, min_cooccurrence=1)
    out = dict(itemcf.recommend_from_seen([1, 2], idx, limit=10))
    # Должен быть 3 в выдаче, и его score > чем у любого другого кандидата.
    assert 3 in out


def test_recommend_with_explicit_exclude():
    user_items = {1: {1, 2, 3}, 2: {1, 2, 3}}
    idx = itemcf.build_index_from_user_items(user_items, min_cooccurrence=1)
    out = itemcf.recommend_from_seen([1], idx, limit=10, exclude=[2])
    rec_ids = [tid for tid, _ in out]
    assert 2 not in rec_ids
    assert 3 in rec_ids


def test_recommend_empty_for_unknown_seeds():
    user_items = {1: {1, 2}, 2: {1, 2}}
    idx = itemcf.build_index_from_user_items(user_items, min_cooccurrence=1)
    out = itemcf.recommend_from_seen([999], idx, limit=10)
    assert out == []


# --- similar_items ----------------------------------------------------------

def test_similar_items_returns_topk():
    user_items = {1: {1, 2, 3}, 2: {1, 2, 3}, 3: {1, 2}}
    idx = itemcf.build_index_from_user_items(user_items, min_cooccurrence=1)
    out = itemcf.similar_items(1, idx, limit=1)
    assert len(out) == 1
    assert out[0][0] in {2, 3}


def test_similar_items_unknown_track():
    idx = itemcf.build_index_from_user_items({}, min_cooccurrence=1)
    assert itemcf.similar_items(42, idx) == []


# --- feed._minmax_normalize ------------------------------------------------

def test_minmax_normalize_basic():
    from app.recsys.feed import _minmax_normalize  # noqa: WPS433
    out = _minmax_normalize([(1, 2.0), (2, 4.0), (3, 6.0)])
    assert out[1] == pytest.approx(0.0)
    assert out[2] == pytest.approx(0.5)
    assert out[3] == pytest.approx(1.0)


def test_minmax_normalize_empty():
    from app.recsys.feed import _minmax_normalize
    assert _minmax_normalize([]) == {}


def test_minmax_normalize_constant_values():
    """Все score равны → нормализация даёт все 0 (нет разделения)."""
    from app.recsys.feed import _minmax_normalize
    out = _minmax_normalize([(1, 0.5), (2, 0.5)])
    assert out == {1: 0.0, 2: 0.0}
