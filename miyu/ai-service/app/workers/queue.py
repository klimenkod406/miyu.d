"""RQ-очередь и хелперы постановки задач."""
from __future__ import annotations

from functools import lru_cache

from redis import Redis
from rq import Queue
from rq.job import Job

from ..config import get_settings


@lru_cache(maxsize=1)
def get_redis() -> Redis:
    return Redis.from_url(get_settings().redis_url)


@lru_cache(maxsize=1)
def get_queue() -> Queue:
    s = get_settings()
    return Queue(s.rq_queue_default, connection=get_redis(), default_timeout=60 * 30)


def enqueue_analyze(track_id: int, file_path: str | None = None) -> Job:
    q = get_queue()
    return q.enqueue(
        "app.workers.tasks.analyze_track_job",
        track_id,
        file_path,
        job_id=f"analyze:{track_id}",
        result_ttl=60 * 60 * 24,
        failure_ttl=60 * 60 * 24 * 7,
    )


def enqueue_rebuild_user_profile(user_id: int) -> Job:
    q = get_queue()
    return q.enqueue(
        "app.workers.tasks.rebuild_user_profile_job",
        user_id,
        job_id=f"profile:{user_id}",
        result_ttl=60 * 60 * 24,
        failure_ttl=60 * 60 * 24 * 7,
    )


def enqueue_rebuild_itemcf() -> Job:
    q = get_queue()
    return q.enqueue(
        "app.workers.tasks.rebuild_itemcf_job",
        job_id="itemcf:rebuild",
        result_ttl=60 * 60 * 24,
        failure_ttl=60 * 60 * 24 * 7,
    )


def enqueue_moderate_cover(track_id: int, image_path: str) -> Job:
    q = get_queue()
    return q.enqueue(
        "app.workers.tasks.moderate_cover_job",
        track_id,
        image_path,
        job_id=f"cover:{track_id}",
    )
