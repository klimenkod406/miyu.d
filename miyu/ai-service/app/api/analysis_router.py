"""HTTP API: запуск анализа трека и модерации обложки.

Эндпоинты:
  POST /analyze            — синхронный прогон пайплайна (для отладки/малых нагрузок).
  POST /analyze/enqueue    — поставить задачу в очередь RQ (асинхронно, рекомендуемый путь).
  POST /moderate/cover     — NSFW-скор для обложки.
  POST /reanalyze          — пересчёт при смене analysis_version (фоновая задача).
  GET  /track/{id}         — отдать сохранённые признаки и решение модерации.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from redis.exceptions import RedisError
from pydantic import BaseModel

from .. import db
from ..analysis import image_moderation, pipeline

logger = logging.getLogger(__name__)
router = APIRouter()


class AnalyzeRequest(BaseModel):
    track_id: int
    file_path: str | None = None  # опционально: переопределить путь


class AnalyzeResponse(BaseModel):
    track_id: int
    ai_score: float
    ai_flags: list[str]
    decision: str
    final_status: str
    auto_approve_limit_reached: bool
    summary: str


class EnqueueResponse(BaseModel):
    job_id: str
    queue: str
    track_id: int


class CoverModerationRequest(BaseModel):
    image_path: str


class CoverModerationResponse(BaseModel):
    nsfw_score: float
    is_nsfw: bool


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_sync(req: AnalyzeRequest) -> AnalyzeResponse:
    try:
        result = pipeline.analyze_track(req.track_id, req.file_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("analyze failed")
        raise HTTPException(status_code=500, detail=str(e))
    return AnalyzeResponse(**{
        k: result[k] for k in (
            "track_id", "ai_score", "ai_flags", "decision",
            "final_status", "auto_approve_limit_reached", "summary",
        )
    })


@router.post("/analyze/enqueue", response_model=EnqueueResponse)
def analyze_enqueue(req: AnalyzeRequest) -> EnqueueResponse:
    from ..workers.queue import enqueue_analyze
    try:
        job = enqueue_analyze(req.track_id, req.file_path)
        return EnqueueResponse(job_id=job.id, queue=job.origin, track_id=req.track_id)
    except RedisError:
        # Локальный dev-режим часто запускается без Redis/worker.
        # В этом случае не валим endpoint, а выполняем анализ сразу.
        logger.exception("enqueue failed, falling back to inline analyze")
        try:
            pipeline.analyze_track(req.track_id, req.file_path)
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.exception("inline analyze after enqueue failure failed")
            raise HTTPException(status_code=500, detail=str(e))
        return EnqueueResponse(
            job_id=f"inline:{req.track_id}",
            queue="inline",
            track_id=req.track_id,
        )


@router.post("/moderate/cover", response_model=CoverModerationResponse)
def moderate_cover(req: CoverModerationRequest) -> CoverModerationResponse:
    score = image_moderation.nsfw_score(req.image_path)
    return CoverModerationResponse(nsfw_score=score, is_nsfw=score >= 0.6)


@router.get("/track/{track_id}")
def get_track_analysis(track_id: int) -> dict[str, Any]:
    row = db.fetch_one(
        """
        SELECT track_id, mood_tags, bpm, key, danceability, energy, valence,
               acousticness, instrumentalness, speechiness, loudness,
               genre_tags, fingerprint, analysis_version,
               ai_score, ai_flags, lyrics_language, analysis_summary,
               updated_at, created_at
        FROM track_analysis WHERE track_id = ?
        """,
        (track_id,),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="analysis not found")
    out = dict(row)
    out["genre_tags"] = db.from_json(out.get("genre_tags"), default=[])
    out["ai_flags"] = db.from_json(out.get("ai_flags"), default=[])
    out["mood_tags"] = (out.get("mood_tags") or "").split(",") if out.get("mood_tags") else []
    return out


@router.get("/track/{track_id}/lyrics")
def get_track_lyrics(track_id: int) -> dict[str, Any]:
    """Возвращает lyrics_text с детальной разметкой explicit-лексики и segments."""
    from ..analysis.text_moderation import analyze_explicit
    row = db.fetch_one(
        """
        SELECT lyrics_text, lyrics_language, segments_json, structure_json, analysis_version
        FROM track_analysis WHERE track_id = ?
        """,
        (track_id,),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="analysis not found")
    payload = dict(row)
    text = payload.get("lyrics_text") or ""
    analysis = analyze_explicit(text) if text else None
    segments = db.from_json(payload.get("segments_json"), default=[])
    structure = db.from_json(payload.get("structure_json"), default=[])
    return {
        "track_id": track_id,
        "lyrics_text": text,
        "lyrics_language": payload.get("lyrics_language"),
        "explicit_words": analysis.matches if analysis else [],
        "explicit_score": analysis.score if analysis else 0.0,
        "explicit_density": analysis.density if analysis else 0.0,
        "explicit_stats": {
            "severe": analysis.severe_count if analysis else 0,
            "moderate": analysis.moderate_count if analysis else 0,
            "mild": analysis.mild_count if analysis else 0,
            "slur": analysis.slur_count if analysis else 0,
            "drug": analysis.drug_count if analysis else 0,
            "total": analysis.total_count if analysis else 0,
            "total_words": analysis.total_words if analysis else 0,
            "has_drug_reference": analysis.has_drug_reference if analysis else False,
            "has_slur": analysis.has_slur if analysis else False,
        },
        "segments": segments,
        "structure": structure,
        "analysis_version": payload.get("analysis_version"),
    }
