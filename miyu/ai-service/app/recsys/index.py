"""hnswlib-индекс по `audio_embedding` всех approved-треков.

Стратегия (Фаза 2 / SQLite):
- Индекс держим в памяти процесса ai-service.
- Lazy-build при первом запросе (`get_index()`).
- Перестроение раз в TTL_SECONDS либо по явной команде `/recsys/index/rebuild`.
- Threadsafe чтение через RLock.

В Фазе 5 (Postgres + pgvector) от этого модуля можно отказаться,
переложив поиск в БД.
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import Optional

import numpy as np

from .. import db

logger = logging.getLogger(__name__)

# Параметры hnswlib (cosine, M=16, efConstruction=200 — компромисс recall/build-time).
_HNSW_M = 16
_HNSW_EF_CONSTRUCTION = 200
_HNSW_EF_QUERY = 64

# Re-build TTL: считаем индекс «свежим» в течение этого окна.
TTL_SECONDS = 60 * 30  # 30 минут


@dataclass
class IndexSnapshot:
    """Состояние индекса. `None` — индекс ещё не построен или пустой."""
    index: object | None         # hnswlib.Index
    track_ids: list[int]         # позиция → track_id
    dim: int
    built_at: float
    size: int


_state: IndexSnapshot | None = None
_lock = threading.RLock()


def _load_embeddings_from_db() -> tuple[list[int], np.ndarray]:
    """Читает все approved-треки с непустым audio_embedding."""
    rows = db.fetch_all(
        """
        SELECT t.id AS track_id, ta.audio_embedding
        FROM tracks t
        JOIN track_analysis ta ON ta.track_id = t.id
        WHERE t.status = 'approved' AND ta.audio_embedding IS NOT NULL
        """
    )
    track_ids: list[int] = []
    vectors: list[np.ndarray] = []
    for r in rows:
        v = db.blob_to_embedding(r["audio_embedding"])
        if v is None or v.size == 0:
            continue
        track_ids.append(int(r["track_id"]))
        vectors.append(v.astype(np.float32))
    if not vectors:
        return [], np.zeros((0, 0), dtype=np.float32)

    # Все эмбеддинги должны быть одинаковой размерности (PANNs CNN14 = 2048).
    dim = vectors[0].shape[0]
    matrix = np.zeros((len(vectors), dim), dtype=np.float32)
    valid_ids: list[int] = []
    for i, (tid, v) in enumerate(zip(track_ids, vectors)):
        if v.shape[0] != dim:
            logger.warning("dim mismatch for track %s: %s != %s — skip", tid, v.shape[0], dim)
            continue
        matrix[len(valid_ids)] = v
        valid_ids.append(tid)
    return valid_ids, matrix[: len(valid_ids)]


def _build() -> IndexSnapshot:
    import hnswlib  # type: ignore
    track_ids, matrix = _load_embeddings_from_db()
    if matrix.shape[0] == 0:
        logger.info("recsys: no approved tracks with audio_embedding yet")
        return IndexSnapshot(index=None, track_ids=[], dim=0, built_at=time.time(), size=0)

    dim = int(matrix.shape[1])
    idx = hnswlib.Index(space="cosine", dim=dim)
    idx.init_index(max_elements=max(matrix.shape[0] * 2, 1024),
                   ef_construction=_HNSW_EF_CONSTRUCTION,
                   M=_HNSW_M)
    idx.add_items(matrix, np.arange(matrix.shape[0]))
    idx.set_ef(_HNSW_EF_QUERY)
    logger.info("recsys: built hnsw index dim=%d size=%d", dim, matrix.shape[0])
    return IndexSnapshot(index=idx, track_ids=track_ids, dim=dim, built_at=time.time(), size=matrix.shape[0])


def get_index(force_rebuild: bool = False) -> IndexSnapshot:
    """Возвращает (строит при необходимости) текущий снапшот индекса."""
    global _state
    with _lock:
        if (
            _state is None
            or force_rebuild
            or (time.time() - _state.built_at) > TTL_SECONDS
        ):
            _state = _build()
        return _state


def query(embedding: np.ndarray, k: int = 10, exclude_track_id: int | None = None) -> list[tuple[int, float]]:
    """k-NN по cosine similarity. Возвращает [(track_id, score), ...] от больше к меньше."""
    snap = get_index()
    if snap.index is None or snap.size == 0:
        return []
    if embedding.shape[0] != snap.dim:
        logger.warning("query dim mismatch: %s != %s", embedding.shape[0], snap.dim)
        return []

    take = min(k + (1 if exclude_track_id is not None else 0), snap.size)
    if take <= 0:
        return []
    labels, distances = snap.index.knn_query(embedding.astype(np.float32), k=take)
    out: list[tuple[int, float]] = []
    for label, dist in zip(labels[0], distances[0]):
        tid = snap.track_ids[int(label)]
        if exclude_track_id is not None and tid == exclude_track_id:
            continue
        # hnswlib cosine distance ∈ [0..2]; similarity = 1 - dist
        score = float(1.0 - dist)
        out.append((tid, score))
        if len(out) >= k:
            break
    return out


def stats() -> dict:
    snap = get_index()
    return {
        "size": snap.size,
        "dim": snap.dim,
        "built_at": snap.built_at,
        "ttl_seconds": TTL_SECONDS,
    }
