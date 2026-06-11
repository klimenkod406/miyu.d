"""Windows-совместимый запуск RQ-воркера.

RQ под Windows не умеет os.fork() и signal.SIGALRM, поэтому используем
SimpleWorker (без форка) и TimerDeathPenalty (на threading.Timer).
"""
from __future__ import annotations

import os
import sys

from redis import Redis
from rq import Queue, SimpleWorker
from rq.timeouts import TimerDeathPenalty


class WindowsWorker(SimpleWorker):
    death_penalty_class = TimerDeathPenalty


def main() -> int:
    url = os.environ.get("MIYU_AI_REDIS_URL", "redis://localhost:6379/0")
    queue_names = sys.argv[1:] or ["miyu-ai"]
    conn = Redis.from_url(url)
    queues = [Queue(name, connection=conn) for name in queue_names]
    worker = WindowsWorker(queues, connection=conn)
    worker.work(with_scheduler=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
