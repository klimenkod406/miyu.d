"""Поиск дубликатов по аудио-эмбеддингу и chromaprint-fingerprint.

Намеренно простая O(N) реализация на старте — пробег по всем `track_analysis`.
Заменим на hnswlib-индекс в Фазе 2.
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np

from .. import db

logger = logging.getLogger(__name__)

DUP_EMB_THRESHOLD = 0.95          # cosine similarity
DUP_FP_PREFIX_LEN = 200           # символов префикса chromaprint для грубой проверки


def find_duplicate_by_embedding(emb: np.ndarray, exclude_track_id: int | None = None) -> tuple[int | None, float]:
    """Возвращает (track_id, score) самого похожего трека или (None, 0.0)."""
    rows = db.fetch_all(
        "SELECT track_id, audio_embedding FROM track_analysis WHERE audio_embedding IS NOT NULL"
    )
    if not rows:
        return None, 0.0

    q = emb.astype(np.float32)
    qn = np.linalg.norm(q) + 1e-9

    best_id, best_score = None, 0.0
    for row in rows:
        if exclude_track_id is not None and row["track_id"] == exclude_track_id:
            continue
        v = db.blob_to_embedding(row["audio_embedding"])
        if v is None or v.size != q.size:
            continue
        score = float(np.dot(q, v) / (qn * (np.linalg.norm(v) + 1e-9)))
        if score > best_score:
            best_score, best_id = score, row["track_id"]
    return best_id, best_score


def find_duplicate_by_fingerprint(fp: str, exclude_track_id: int | None = None) -> Optional[int]:
    if not fp:
        return None
    prefix = fp[:DUP_FP_PREFIX_LEN]
    rows = db.fetch_all(
        "SELECT track_id FROM track_analysis WHERE fingerprint LIKE ? AND track_id != ?",
        (f"{prefix}%", exclude_track_id or -1),
    )
    return rows[0]["track_id"] if rows else None
