"""Точка входа RQ-worker'а: `python worker.py`.

Запускает воркера, слушающего очередь из настроек.
"""
from __future__ import annotations

from rq import Worker

from app.config import get_settings
from app.workers.queue import get_queue, get_redis


def main() -> None:
    settings = get_settings()
    queue = get_queue()
    worker = Worker([queue], connection=get_redis(), name=f"miyu-ai-{settings.rq_queue_default}")
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
