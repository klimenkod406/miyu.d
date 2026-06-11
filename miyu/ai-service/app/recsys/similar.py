"""High-level API: similar tracks для `/recsys/similar/track/{id}`.

Логика:
1. Достать `audio_embedding` исходного трека.
2. Найти top-K ближайших через `index.query()`.
3. Подгрузить метаданные кандидатов из БД (title/artist/cover_url/duration).
4. Закешировать ответ в Redis на TTL_SEC.

Кеш-ключ: `recsys:sim:track:{id}:limit:{N}:v{version}` (версия меняется при пересборе индекса).
"""
from __future__ import annotations

import json
import logging
from typing import Any

from .. import db
from . import index as idx_mod

logger = logging.getLogger(__name__)

CACHE_TTL_SEC = 60 * 60  # 1 час


def _cache_key(track_id: int, limit: int) -> str:
    snap = idx_mod.get_index()
    # built_at \u2014 \u0438\u043d\u0432\u0430\u043b\u0438\u0434\u0430\u0446\u0438\u044f \u043f\u043e\u0441\u043b\u0435 \u043f\u0435\u0440\u0435\u0441\u0431\u043e\u0440\u0430.
    return f"recsys:sim:track:{track_id}:limit:{limit}:v{int(snap.built_at)}"


def _redis():
    try:
        from ..workers.queue import get_redis  # noqa: WPS433 (local import to avoid cycles)
        return get_redis()
    except Exception as e:  # pragma: no cover
        logger.warning("redis unavailable: %s", e)
        return None


def _load_track_meta(track_ids: list[int]) -> dict[int, dict]:
    if not track_ids:
        return {}
    placeholders = ",".join("?" * len(track_ids))
    rows = db.fetch_all(
        f"""
        SELECT t.id, t.title, t.duration, t.cover_url, t.file_path, t.artist_id, t.is_explicit,
               u.username AS artist_name, u.is_verified AS artist_is_verified,
               a.id AS album_id, a.title AS album_title, a.cover_url AS album_cover
        FROM tracks t
        JOIN users u ON u.id = t.artist_id
        LEFT JOIN albums a ON a.id = t.album_id
        WHERE t.id IN ({placeholders}) AND t.status = 'approved'
        """,
        tuple(track_ids),
    )
    return {int(r["id"]): dict(r) for r in rows}


def find_similar(track_id: int, limit: int = 10) -> dict[str, Any]:
    """\u0413\u043b\u0430\u0432\u043d\u0430\u044f \u0444\u0443\u043d\u043a\u0446\u0438\u044f. \u0412\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 {tracks: [...], cached: bool, index_size}."""
    limit = max(1, min(limit, 50))

    redis = _redis()
    cache_key = _cache_key(track_id, limit)
    if redis is not None:
        try:
            cached = redis.get(cache_key)
            if cached:
                payload = json.loads(cached)
                payload["cached"] = True
                return payload
        except Exception as e:
            logger.warning("redis get failed: %s", e)

    # 1. \u0418\u0441\u0445\u043e\u0434\u043d\u044b\u0439 \u044d\u043c\u0431\u0435\u0434\u0434\u0438\u043d\u0433
    row = db.fetch_one(
        "SELECT audio_embedding FROM track_analysis WHERE track_id = ?",
        (track_id,),
    )
    if row is None or row["audio_embedding"] is None:
        return {"track_id": track_id, "tracks": [], "cached": False, "reason": "no_embedding"}
    emb = db.blob_to_embedding(row["audio_embedding"])
    if emb is None:
        return {"track_id": track_id, "tracks": [], "cached": False, "reason": "empty_embedding"}

    # 2. k-NN
    hits = idx_mod.query(emb, k=limit, exclude_track_id=track_id)
    if not hits:
        return {"track_id": track_id, "tracks": [], "cached": False, "reason": "empty_index"}

    # 3. \u041c\u0435\u0442\u0430\u0434\u0430\u043d\u043d\u044b\u0435
    ids = [tid for tid, _ in hits]
    meta = _load_track_meta(ids)
    out_tracks: list[dict] = []
    for tid, score in hits:
        m = meta.get(tid)
        if not m:
            continue  # \u043e\u0442\u0444\u0438\u043b\u044c\u0442\u0440\u043e\u0432\u0430\u043d \u043f\u043e status='approved'
        out_tracks.append({
            "id": tid,
            "title": m["title"],
            "duration": m["duration"],
            "cover_url": m["cover_url"],
            "file_path": m["file_path"],
            "artist_id": m["artist_id"],
            "is_explicit": bool(m["is_explicit"]),
            "artist": {
                "id": m["artist_id"],
                "username": m["artist_name"],
                "is_verified": bool(m["artist_is_verified"]),
            },
            "album": {
                "id": m["album_id"],
                "title": m["album_title"],
                "cover_url": m["album_cover"],
            } if m["album_id"] else None,
            "similarity": round(score, 4),
        })

    snap = idx_mod.get_index()
    payload = {
        "track_id": track_id,
        "tracks": out_tracks,
        "cached": False,
        "index_size": snap.size,
    }

    if redis is not None:
        try:
            redis.setex(cache_key, CACHE_TTL_SEC, json.dumps(payload, default=str))
        except Exception as e:
            logger.warning("redis setex failed: %s", e)

    return payload
