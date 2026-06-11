"""Re-ranker для feed: MMR diversity + фильтры + ограничение по артисту.

Алгоритм MMR (Maximal Marginal Relevance):
    score(c) = λ * relevance(c) - (1 - λ) * max_{s in selected} sim(c, s)

При λ=1 — чистый top-K по релевантности; λ=0 — максимум разнообразия.
Дефолт 0.7 — мягкая diversity.
"""
from __future__ import annotations

from typing import Iterable

import numpy as np


def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    na = float(np.linalg.norm(a)) + 1e-9
    nb = float(np.linalg.norm(b)) + 1e-9
    return float(np.dot(a, b) / (na * nb))


def mmr_select(
    candidates: list[tuple[int, float]],     # [(track_id, relevance_score)]
    embeddings: dict[int, np.ndarray],
    limit: int,
    lambda_diversity: float = 0.7,
    max_per_artist: int | None = 2,
    artist_of: dict[int, int] | None = None,
) -> list[tuple[int, float]]:
    """Greedy MMR с ограничением «не более N треков одного артиста».

    Сложность O(K * N) где N=len(candidates), K=limit.
    """
    if not candidates:
        return []

    artist_of = artist_of or {}
    by_id = {tid: rel for tid, rel in candidates}

    selected: list[tuple[int, float]] = []
    selected_embs: list[np.ndarray] = []
    artist_counts: dict[int, int] = {}
    remaining = list(candidates)

    while remaining and len(selected) < limit:
        best_idx = -1
        best_score = -1e18
        for i, (tid, rel) in enumerate(remaining):
            # Лимит на артиста.
            if max_per_artist is not None:
                aid = artist_of.get(tid)
                if aid is not None and artist_counts.get(aid, 0) >= max_per_artist:
                    continue
            emb = embeddings.get(tid)
            if not selected_embs or emb is None:
                penalty = 0.0
            else:
                penalty = max(cosine_sim(emb, s) for s in selected_embs)
            score = lambda_diversity * rel - (1.0 - lambda_diversity) * penalty
            if score > best_score:
                best_score = score
                best_idx = i
        if best_idx < 0:
            break
        tid, rel = remaining.pop(best_idx)
        selected.append((tid, rel))
        emb = embeddings.get(tid)
        if emb is not None:
            selected_embs.append(emb)
        if max_per_artist is not None:
            aid = artist_of.get(tid)
            if aid is not None:
                artist_counts[aid] = artist_counts.get(aid, 0) + 1

    return selected


def filter_listened_today(
    candidates: Iterable[tuple[int, float]],
    listened_today_ids: Iterable[int],
) -> list[tuple[int, float]]:
    """Убирает треки, которые пользователь прослушивал сегодня (anti-repeat)."""
    excluded = {int(i) for i in listened_today_ids}
    return [(tid, s) for tid, s in candidates if tid not in excluded]


def filter_explicit_dislikes(
    candidates: Iterable[tuple[int, float]],
    disliked_ids: Iterable[int],
) -> list[tuple[int, float]]:
    """Убирает треки, по которым пользователь явно поставил dislike."""
    excluded = {int(i) for i in disliked_ids}
    return [(tid, s) for tid, s in candidates if tid not in excluded]


def filter_seen_items(
    candidates: Iterable[tuple[int, float]],
    seen_ids: Iterable[int],
) -> list[tuple[int, float]]:
    """Убирает уже знакомые треки из candidate pool перед rerank."""
    excluded = {int(i) for i in seen_ids}
    return [(tid, s) for tid, s in candidates if tid not in excluded]


def filter_blocked_artists(
    candidates: Iterable[tuple[int, float]],
    artist_of: dict[int, int],
    blocked_artist_ids: Iterable[int],
) -> list[tuple[int, float]]:
    """Убирает треки артистов, которых пользователь явно скрыл/dislike'нул."""
    blocked = {int(i) for i in blocked_artist_ids}
    return [
        (tid, s)
        for tid, s in candidates
        if artist_of.get(int(tid)) not in blocked
    ]


def dedupe_keep_best(candidates: Iterable[tuple[int, float]]) -> list[tuple[int, float]]:
    """Дедупликация candidate pool по track_id с сохранением лучшего score."""
    best: dict[int, float] = {}
    for tid, score in candidates:
        tid = int(tid)
        score = float(score)
        prev = best.get(tid)
        if prev is None or score > prev:
            best[tid] = score
    return sorted(best.items(), key=lambda item: -item[1])
