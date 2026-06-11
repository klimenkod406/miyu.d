"""Popularity / Trending — fallback для холодного старта и бустинг для re-ranker.

Формула Hacker News:
    score = (plays - 1) / (hours_age + 2)^GRAVITY

Где `hours_age` — часы с момента создания трека, `GRAVITY=1.8` (стандартный HN).
Эта формула штрафует старые треки и поощряет «бурю» свежих плеев.

В Фазе 3 используем popularity_score как:
- основной кандидат-генератор для пользователей с `interactions_count < 20`,
- буст в re-ranker для всех остальных (β-вес).
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Iterable

from .. import db

GRAVITY = 1.8
DEFAULT_WINDOW_DAYS = 30


def hn_score(plays: int, hours_age: float, gravity: float = GRAVITY) -> float:
    """Hacker News-стиль: (plays - 1) / (age + 2)^gravity.

    `plays - 1` штрафует треки с одним фейковым плеем; для треков с 0 plays
    отдаём 0 — пусть лучше всплывут чужие.
    """
    if plays <= 0:
        return 0.0
    age_factor = (max(0.0, hours_age) + 2.0) ** gravity
    return (plays - 1) / age_factor


def trending_tracks(window_days: int = DEFAULT_WINDOW_DAYS, limit: int = 200) -> list[dict]:
    """Возвращает топ-треков по HN-score за последние `window_days`.

    Берёт plays за окно (а не lifetime) — иначе старые треки навсегда
    забивают чарт.
    """
    cutoff = datetime.now(timezone.utc).timestamp() - window_days * 86400
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    rows = db.fetch_all(
        """
        SELECT t.id AS track_id, t.created_at,
               COUNT(tp.id) AS plays_window
        FROM tracks t
        LEFT JOIN track_plays tp
          ON tp.track_id = t.id AND COALESCE(tp.played_at, tp.created_at) >= ?
        WHERE t.status = 'approved'
        GROUP BY t.id
        HAVING plays_window > 0
        """,
        (cutoff_iso,),
    )
    now = datetime.now(timezone.utc)
    scored: list[tuple[int, float, int]] = []
    for r in rows:
        try:
            created = datetime.fromisoformat(str(r["created_at"]).replace("Z", "+00:00"))
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            created = now
        hours_age = max(0.0, (now - created).total_seconds() / 3600.0)
        plays = int(r["plays_window"] or 0)
        s = hn_score(plays, hours_age)
        if s > 0:
            scored.append((int(r["track_id"]), s, plays))

    scored.sort(key=lambda kv: -kv[1])
    return [{"track_id": tid, "score": s, "plays": p} for tid, s, p in scored[:limit]]


def popular_track_ids(limit: int = 100, exclude_ids: Iterable[int] = ()) -> list[tuple[int, float]]:
    """Сокращённое API: только (track_id, score), с фильтрацией exclude."""
    excl = {int(i) for i in exclude_ids}
    return [
        (item["track_id"], item["score"])
        for item in trending_tracks(limit=limit + len(excl))
        if item["track_id"] not in excl
    ][:limit]
