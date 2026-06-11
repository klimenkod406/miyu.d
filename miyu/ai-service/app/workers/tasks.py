"""RQ-задачи: тонкие обёртки вокруг pipeline.

Импортируются строкой `app.workers.tasks.<func>` — RQ-worker должен запускаться
с `PYTHONPATH=/app` (см. Dockerfile / docker-compose).
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

from .. import db
from ..analysis import image_moderation, pipeline
from ..recsys import profile as profile_mod, feed as feed_mod, itemcf as itemcf_mod
from .. import metrics as m

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _job_start(job_type: str, target_id: int) -> int:
    return db.execute(
        "INSERT INTO ai_jobs (job_type, target_id, status, started_at) VALUES (?, ?, 'running', ?)",
        (job_type, target_id, _now()),
    )


def _job_done(job_id: int) -> None:
    db.execute("UPDATE ai_jobs SET status='done', finished_at=? WHERE id=?", (_now(), job_id))


def _job_fail(job_id: int, err: str) -> None:
    db.execute(
        "UPDATE ai_jobs SET status='failed', error=?, finished_at=? WHERE id=?",
        (err[:1000], _now(), job_id),
    )


def analyze_track_job(track_id: int, file_path: str | None = None) -> dict[str, Any]:
    job_id = _job_start("analyze_track", track_id)
    start_time = time.time()
    try:
        result = pipeline.analyze_track(track_id, file_path)
        _job_done(job_id)
        
        # Metrics
        duration = time.time() - start_time
        m.worker_jobs_total.labels(job_type='analyze_track', status='done').inc()
        m.worker_job_duration_seconds.labels(job_type='analyze_track').observe(duration)
        
        return result
    except Exception as e:
        logger.exception("analyze_track_job failed for track %s", track_id)
        _job_fail(job_id, str(e))
        m.worker_jobs_total.labels(job_type='analyze_track', status='failed').inc()
        raise


def rebuild_user_profile_job(user_id: int) -> dict[str, Any]:
    """Пересобирает профиль вкуса пользователя и инвалидирует его feed-кеш."""
    job_id = _job_start("rebuild_user_profile", user_id)
    start_time = time.time()
    try:
        result = profile_mod.rebuild_user_profile(user_id)
        feed_mod.invalidate_user_feed_cache(user_id)
        _job_done(job_id)
        
        # Metrics
        duration = time.time() - start_time
        m.worker_jobs_total.labels(job_type='rebuild_profile', status='done').inc()
        m.worker_job_duration_seconds.labels(job_type='rebuild_profile').observe(duration)
        
        return {
            "user_id": user_id,
            "interactions_count": result.interactions_count,
            "has_centroid": result.taste_embedding is not None,
            "diversity": result.diversity,
        }
    except Exception as e:
        logger.exception("rebuild_user_profile_job failed for user %s", user_id)
        _job_fail(job_id, str(e))
        m.worker_jobs_total.labels(job_type='rebuild_profile', status='failed').inc()
        raise


def rebuild_itemcf_job() -> dict[str, Any]:
    """Ночной (или on-demand) пересбор item-item CF индекса."""
    job_id = _job_start("rebuild_itemcf", 0)
    start_time = time.time()
    try:
        idx = itemcf_mod.build_and_save_index()
        _job_done(job_id)
        
        # Metrics
        duration = time.time() - start_time
        m.worker_jobs_total.labels(job_type='rebuild_itemcf', status='done').inc()
        m.worker_job_duration_seconds.labels(job_type='rebuild_itemcf').observe(duration)
        
        return {"size": idx.size, "n_users": idx.n_users, "built_at": idx.built_at}
    except Exception as e:
        logger.exception("rebuild_itemcf_job failed")
        _job_fail(job_id, str(e))
        m.worker_jobs_total.labels(job_type='rebuild_itemcf', status='failed').inc()
        raise


def moderate_cover_job(track_id: int, image_path: str) -> dict[str, Any]:
    job_id = _job_start("moderate_cover", track_id)
    try:
        score = image_moderation.nsfw_score(image_path)
        _job_done(job_id)
        return {"track_id": track_id, "nsfw_score": score, "is_nsfw": score >= 0.6}
    except Exception as e:
        _job_fail(job_id, str(e))
        raise
