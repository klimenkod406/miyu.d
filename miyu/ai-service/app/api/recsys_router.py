"""HTTP API подсистемы рекомендаций.

Эндпоинты:
  GET  /recsys/similar/track/{track_id}?limit=10  — похожие треки.
  GET  /recsys/feed?user_id=&limit=               — Daily Mix («Моя волна»).
  POST /recsys/feedback                            — explicit feedback.
  POST /recsys/profile/rebuild?user_id=            — пересобрать профиль.
  GET  /recsys/profile/{user_id}                   — текущий профиль (debug).
  GET  /recsys/index/stats                         — состояние индекса.
  POST /recsys/index/rebuild                       — принудительный пересбор.
"""
from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from .. import db
from ..recsys import feed as feed_mod
from ..recsys import index as idx_mod
from ..recsys import itemcf as itemcf_mod
from ..recsys import feedback_store
from ..recsys import profile as profile_mod
from ..recsys.similar import find_similar

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recsys", tags=["recsys"])


@router.get("/similar/track/{track_id}")
def similar_track(track_id: int, limit: int = Query(10, ge=1, le=50)) -> dict:
    try:
        return find_similar(track_id, limit)
    except Exception as e:
        logger.exception("similar_track failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/index/stats")
def index_stats() -> dict:
    return idx_mod.stats()


@router.post("/index/rebuild")
def index_rebuild() -> dict:
    snap = idx_mod.get_index(force_rebuild=True)
    return {"ok": True, "size": snap.size, "dim": snap.dim, "built_at": snap.built_at}


# ---------- Feed ----------

@router.get("/feed")
def get_feed(user_id: int = Query(..., ge=1), limit: int = Query(50, ge=1, le=100)) -> dict:
    try:
        return feed_mod.build_feed(user_id, limit)
    except Exception as e:
        logger.exception("build_feed failed")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Feedback ----------

class FeedbackPayload(BaseModel):
    user_id: int = Field(..., ge=1)
    target_type: Literal["track", "artist", "genre"]
    target_id: int = Field(..., ge=1)
    score: int = Field(..., description="+1 like, -1 dislike, -2 do-not-show")
    reason: str | None = None


@router.post("/feedback")
def post_feedback(p: FeedbackPayload) -> dict:
    try:
        feedback_store.insert_feedback(
            user_id=p.user_id,
            target_type=p.target_type,
            target_id=p.target_id,
            score=p.score,
            reason=p.reason,
        )
        feed_mod.invalidate_user_feed_cache(p.user_id)
        
        # Metrics (Phase 5)
        from .. import metrics as m
        m.recsys_feedback_total.labels(target_type=p.target_type, score=str(p.score)).inc()
        
        return {"ok": True}
    except Exception as e:
        logger.exception("feedback failed")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Profile ----------

@router.post("/profile/rebuild")
def profile_rebuild(user_id: int = Query(..., ge=1)) -> dict:
    try:
        result = profile_mod.rebuild_user_profile(user_id)
        feed_mod.invalidate_user_feed_cache(user_id)
        return {
            "ok": True,
            "user_id": user_id,
            "interactions_count": result.interactions_count,
            "has_centroid": result.taste_embedding is not None,
            "diversity": result.diversity,
            "top_genres": result.top_genres,
            "top_moods": result.top_moods,
        }
    except Exception as e:
        logger.exception("profile_rebuild failed")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Item-CF (Phase 4 lite) ----------

@router.get("/cf/stats")
def cf_stats() -> dict:
    return itemcf_mod.stats()


@router.post("/cf/rebuild")
def cf_rebuild() -> dict:
    idx = itemcf_mod.build_and_save_index()
    return {
        "ok": True,
        "size": idx.size,
        "n_users": idx.n_users,
        "built_at": idx.built_at,
    }


@router.get("/cf/similar/{track_id}")
def cf_similar(track_id: int, limit: int = Query(10, ge=1, le=50)) -> dict:
    idx = itemcf_mod.get_index()
    rows = itemcf_mod.similar_items(track_id, idx, limit)
    return {"track_id": track_id, "neighbors": [{"track_id": tid, "sim": s} for tid, s in rows]}


@router.get("/profile/{user_id}")
def profile_get(user_id: int) -> dict:
    prof = profile_mod.get_profile(user_id)
    if prof is None:
        raise HTTPException(status_code=404, detail="profile not found")
    # Не отдаём raw embedding наружу — это много байт.
    return {
        "user_id": prof["user_id"],
        "has_centroid": prof["taste_embedding"] is not None,
        "interactions_count": prof["interactions_count"],
        "profile_version": prof["profile_version"],
        "top_genres": prof["top_genres"],
        "top_moods": prof["top_moods"],
        "bpm_mean": prof["bpm_mean"],
        "bpm_std": prof["bpm_std"],
        "energy_mean": prof["energy_mean"],
        "valence_mean": prof["valence_mean"],
        "danceability_mean": prof["danceability_mean"],
        "diversity": prof["diversity"],
        "updated_at": prof["updated_at"],
    }
