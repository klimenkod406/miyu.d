"""Feed «Моя волна» — Daily Mix для пользователя.

Стратегия (Фаза 3):
- `interactions_count < 20` → popularity-фолбэк (HN-формула).
- иначе → CB через kNN от `taste_embedding` в hnsw-индексе.
- В обоих случаях прогоняем через единый re-ranker:
   * фильтр прослушанных сегодня,
   * фильтр явных dislike,
   * MMR diversity (λ=0.7, max 2 трека на артиста).

Кеш Redis с TTL 1 час; ключ versioning по `profile.updated_at`.
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from typing import Any

import numpy as np

from .. import db
from .. import metrics as m
from . import index as idx_mod
from . import feedback_store
from . import itemcf, popularity, profile as profile_mod, reranker

logger = logging.getLogger(__name__)

CACHE_TTL_SEC = 60 * 60  # 1 час
ONBOARDING_THRESHOLD = 20
CANDIDATE_POOL_SIZE = 200
MMR_LAMBDA = 0.7
MMR_MAX_PER_ARTIST = 2
SEED_TRACKS_LIMIT = 12
SEED_NEIGHBORS_K = 18

# Гибридные веса (Фаза 4 lite). Сумма не обязана = 1, важны относительные.
HYBRID_W_CB = 0.6
HYBRID_W_CF = 0.4
HYBRID_W_POP = 0.05  # лёгкий буст свежей популярки в общий пул
HYBRID_W_SEED = 0.45


def _redis():
    try:
        from ..workers.queue import get_redis  # noqa: WPS433
        return get_redis()
    except Exception as e:  # pragma: no cover
        logger.warning("redis unavailable: %s", e)
        return None


def _cache_key(user_id: int, limit: int, profile_version_tag: str) -> str:
    return f"recsys:feed:user:{user_id}:limit:{limit}:v:{profile_version_tag}"


def _profile_tag(prof: dict | None) -> str:
    """Версия для кеш-ключа: time-bucket updated_at + interactions_count.

    Любое обновление профиля инвалидирует кеш этого пользователя.
    """
    if not prof:
        return "noprofile"
    return f"{prof.get('updated_at', '0')}:{prof.get('interactions_count', 0)}"


def _user_listened_today(user_id: int) -> set[int]:
    """ID треков, которые пользователь слушал в последние 24 часа."""
    cutoff = datetime.now(timezone.utc).timestamp() - 24 * 3600
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    rows = db.fetch_all(
        """
        SELECT DISTINCT track_id FROM track_plays
        WHERE user_id = ? AND COALESCE(played_at, created_at) >= ?
        """,
        (user_id, cutoff_iso),
    )
    return {int(r["track_id"]) for r in rows}


def _user_dislikes(user_id: int) -> set[int]:
    rows = feedback_store.negative_feedback_rows(user_id, "track")
    return {int(r["target_id"]) for r in rows if r.get("target_id") is not None}


def _user_blocked_artists(user_id: int) -> set[int]:
    rows = feedback_store.negative_feedback_rows(user_id, "artist")
    return {int(r["target_id"]) for r in rows if r.get("target_id") is not None}


def _user_seen_tracks(user_id: int) -> set[int]:
    rows = db.fetch_all(
        """
        SELECT DISTINCT track_id FROM track_plays WHERE user_id = ?
        UNION
        SELECT DISTINCT track_id FROM likes WHERE user_id = ?
        UNION
        SELECT DISTINCT pt.track_id
        FROM playlist_tracks pt
        JOIN playlists p ON p.id = pt.playlist_id
        WHERE p.user_id = ?
        """,
        (user_id, user_id, user_id),
    )
    return {int(r["track_id"]) for r in rows if r["track_id"] is not None}


def _load_track_meta_with_artist(
    track_ids: list[int],
) -> tuple[dict[int, dict], dict[int, np.ndarray], dict[int, int]]:
    """Метаданные треков + audio_embedding + artist_id (для MMR)."""
    if not track_ids:
        return {}, {}, {}
    placeholders = ",".join("?" * len(track_ids))
    rows = db.fetch_all(
        f"""
        SELECT t.id, t.title, t.duration, t.cover_url, t.file_path, t.artist_id, t.is_explicit,
               u.username AS artist_name, u.is_verified AS artist_is_verified,
               a.id AS album_id, a.title AS album_title, a.cover_url AS album_cover,
               ta.audio_embedding
        FROM tracks t
        JOIN users u ON u.id = t.artist_id
        LEFT JOIN albums a ON a.id = t.album_id
        LEFT JOIN track_analysis ta ON ta.track_id = t.id
        WHERE t.id IN ({placeholders}) AND t.status = 'approved'
        """,
        tuple(track_ids),
    )
    meta: dict[int, dict] = {}
    embs: dict[int, np.ndarray] = {}
    artist_of: dict[int, int] = {}
    for r in rows:
        tid = int(r["id"])
        meta[tid] = {
            "id": tid,
            "title": r["title"],
            "duration": r["duration"],
            "cover_url": r["cover_url"],
            "file_path": r["file_path"],
            "artist_id": int(r["artist_id"]),
            "is_explicit": bool(r["is_explicit"]),
            "artist": {
                "id": int(r["artist_id"]),
                "username": r["artist_name"],
                "is_verified": bool(r["artist_is_verified"]),
            },
            "album": (
                {"id": int(r["album_id"]), "title": r["album_title"], "cover_url": r["album_cover"]}
                if r["album_id"] is not None else None
            ),
        }
        artist_of[tid] = int(r["artist_id"])
        e = db.blob_to_embedding(r["audio_embedding"])
        if e is not None and e.size:
            embs[tid] = e
    return meta, embs, artist_of


# ---------------------------------------------------- candidate generation ---

def _minmax_normalize(scores: list[tuple[int, float]]) -> dict[int, float]:
    """min-max нормализация в [0, 1]; пустой/константный → все 0."""
    if not scores:
        return {}
    vals = [s for _, s in scores]
    lo, hi = min(vals), max(vals)
    if hi - lo < 1e-12:
        return {tid: 0.0 for tid, _ in scores}
    span = hi - lo
    return {tid: (s - lo) / span for tid, s in scores}


def _generate_candidates(
    user_id: int,
    prof: dict | None,
    can_personalize: bool,
) -> list[tuple[int, float]]:
    """Гибридное слияние:  α*CB + β*CF + γ*popularity (с min-max-нормализацией каждого источника)."""
    cb_scores: list[tuple[int, float]] = []
    cf_scores: list[tuple[int, float]] = []
    seed_scores: list[tuple[int, float]] = []
    pop_scores: list[tuple[int, float]] = popularity.popular_track_ids(limit=CANDIDATE_POOL_SIZE)

    if can_personalize and prof is not None:
        emb = prof["taste_embedding"]
        try:
            cb_scores = idx_mod.query(emb, k=CANDIDATE_POOL_SIZE)
        except Exception as e:
            logger.warning("CB query failed: %s", e)
        try:
            cf_scores = itemcf.recommend_for_user(user_id, limit=CANDIDATE_POOL_SIZE)
        except Exception as e:
            logger.warning("CF recommend failed: %s", e)
        seed_track_ids = profile_mod.get_seed_track_ids(user_id, limit=SEED_TRACKS_LIMIT)
        if seed_track_ids:
            for seed_id in seed_track_ids:
                row = db.fetch_one(
                    "SELECT audio_embedding FROM track_analysis WHERE track_id = ?",
                    (seed_id,),
                )
                if row is None or row["audio_embedding"] is None:
                    continue
                seed_emb = db.blob_to_embedding(row["audio_embedding"])
                if seed_emb is None:
                    continue
                try:
                    for tid, score in idx_mod.query(seed_emb, k=SEED_NEIGHBORS_K, exclude_track_id=seed_id):
                        seed_scores.append((tid, score))
                except Exception as e:
                    logger.warning("seed-neighbors query failed for %s: %s", seed_id, e)

    cb_n = _minmax_normalize(cb_scores)
    cf_n = _minmax_normalize(cf_scores)
    seed_n = _minmax_normalize(reranker.dedupe_keep_best(seed_scores))
    pop_n = _minmax_normalize(pop_scores)

    if not can_personalize or (not cb_n and not cf_n and not seed_n):
        # Холодный старт — только популярка.
        return [(tid, s) for tid, s in pop_n.items()]

    all_ids = set(cb_n) | set(cf_n) | set(seed_n) | set(pop_n)
    fused: list[tuple[int, float]] = []
    for tid in all_ids:
        score = (
            HYBRID_W_CB * cb_n.get(tid, 0.0)
            + HYBRID_W_CF * cf_n.get(tid, 0.0)
            + HYBRID_W_SEED * seed_n.get(tid, 0.0)
            + HYBRID_W_POP * pop_n.get(tid, 0.0)
        )
        if score > 0:
            fused.append((tid, score))
    fused.sort(key=lambda kv: -kv[1])
    return fused[:CANDIDATE_POOL_SIZE]


# ---------------------------------------------------------- main entry point ---

def build_feed(user_id: int, limit: int = 50) -> dict[str, Any]:
    """Главная точка входа: строит персональную ленту для пользователя."""
    start_time = time.time()
    
    # 1) Профиль + кеш.
    prof = profile_mod.get_profile(user_id)
    prof_tag = _profile_tag(prof)
    cache_key = _cache_key(user_id, limit, prof_tag)

    redis = _redis()
    if redis is not None:
        try:
            cached_str = redis.get(cache_key)
            if cached_str:
                m.recsys_cache_requests_total.labels(cache_type='feed', result='hit').inc()
                payload = json.loads(cached_str)
                payload["cached"] = True
                return payload
        except Exception as e:
            logger.warning("redis get failed: %s", e)
    
    m.recsys_cache_requests_total.labels(cache_type='feed', result='miss').inc()

    interactions = int(prof["interactions_count"]) if prof else 0
    has_centroid = prof is not None and prof.get("taste_embedding") is not None
    can_personalize = has_centroid and interactions >= ONBOARDING_THRESHOLD

    # 2) Generate candidates: hybrid CB + itemCF + popularity boost.
    candidates = _generate_candidates(user_id, prof, can_personalize)
    if not candidates:
        mode = "popularity"
        candidates = popularity.popular_track_ids(limit=CANDIDATE_POOL_SIZE)
    else:
        mode = "hybrid" if can_personalize else "popularity"

    # 3) Filters.
    listened_today = _user_listened_today(user_id)
    dislikes = _user_dislikes(user_id)
    blocked_artists = _user_blocked_artists(user_id)
    seen_tracks = _user_seen_tracks(user_id)
    candidates = reranker.filter_listened_today(candidates, listened_today)
    candidates = reranker.filter_explicit_dislikes(candidates, dislikes)
    candidates = reranker.filter_seen_items(candidates, seen_tracks)

    # 4) Подгружаем метаданные кандидатов.
    cand_ids = [tid for tid, _ in candidates]
    meta, embs, artist_of = _load_track_meta_with_artist(cand_ids)

    candidates = reranker.filter_blocked_artists(candidates, artist_of, blocked_artists)

    # Только approved (т.е. остались в meta).
    candidates = [(tid, s) for tid, s in candidates if tid in meta]

    # 5) MMR re-rank.
    selected = reranker.mmr_select(
        candidates,
        embs,
        limit=limit,
        lambda_diversity=MMR_LAMBDA,
        max_per_artist=MMR_MAX_PER_ARTIST,
        artist_of=artist_of,
    )

    out_tracks = []
    for tid, score in selected:
        m_track = meta[tid]
        out_tracks.append({**m_track, "score": round(float(score), 4)})

    payload = {
        "user_id": user_id,
        "mode": mode,
        "interactions_count": interactions,
        "profile_version": prof.get("profile_version") if prof else None,
        "tracks": out_tracks,
        "cached": False,
    }

    if redis is not None:
        try:
            redis.setex(cache_key, CACHE_TTL_SEC, json.dumps(payload))
        except Exception as e:
            logger.warning("redis setex failed: %s", e)

    # Metrics (Phase 5)
    duration = time.time() - start_time
    m.recsys_feed_duration_seconds.labels(mode=mode).observe(duration)

    return payload


def invalidate_user_feed_cache(user_id: int) -> int:
    """Точечная инвалидация (например, после feedback). Возвращает кол-во удалённых ключей."""
    redis = _redis()
    if redis is None:
        return 0
    try:
        keys = list(redis.scan_iter(f"recsys:feed:user:{user_id}:*"))
        if not keys:
            return 0
        return int(redis.delete(*keys))
    except Exception as e:  # pragma: no cover
        logger.warning("invalidate cache failed: %s", e)
        return 0
