"""Совместимый слой доступа к recsys_feedback.

Поддерживает две реальные схемы, которые сейчас встречаются в проекте:

1. Новая score-based:
   (user_id, target_type, target_id, score, reason, created_at)
2. Старая signal-based:
   (user_id, target_type, target_id, target_value, signal, created_at)

Это позволяет алгоритмам и API работать одинаково независимо от версии миграций.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any

from .. import db


@lru_cache(maxsize=1)
def _feedback_columns() -> set[str]:
    rows = db.fetch_all("PRAGMA table_info(recsys_feedback)")
    return {str(r["name"]) for r in rows}


def uses_score_schema() -> bool:
    cols = _feedback_columns()
    return "score" in cols


def insert_feedback(
    user_id: int,
    target_type: str,
    target_id: int,
    score: int,
    reason: str | None = None,
) -> None:
    if uses_score_schema():
        db.execute(
            """
            INSERT INTO recsys_feedback (user_id, target_type, target_id, score, reason)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, target_type, target_id, score, reason),
        )
        return

    signal = _score_to_signal(score)
    if signal is None:
        return
    db.execute(
        """
        INSERT INTO recsys_feedback (user_id, target_type, target_id, target_value, signal)
        VALUES (?, ?, ?, NULL, ?)
        """,
        (user_id, target_type, target_id, signal),
    )


def negative_feedback_rows(user_id: int, target_type: str, cutoff_iso: str | None = None) -> list[dict[str, Any]]:
    params: list[Any] = [user_id, target_type]
    time_filter = ""
    if cutoff_iso is not None:
        time_filter = " AND created_at >= ?"
        params.append(cutoff_iso)

    if uses_score_schema():
        rows = db.fetch_all(
            f"""
            SELECT target_id, created_at, score
            FROM recsys_feedback
            WHERE user_id = ? AND target_type = ? AND score < 0{time_filter}
            """,
            tuple(params),
        )
    else:
        rows = db.fetch_all(
            f"""
            SELECT target_id, created_at,
                   CASE signal
                     WHEN 'less_like_this' THEN -1
                     WHEN 'dislike' THEN -1
                     WHEN 'hide' THEN -2
                     ELSE 0
                   END AS score
            FROM recsys_feedback
            WHERE user_id = ? AND target_type = ?
              AND signal IN ('dislike', 'hide', 'less_like_this'){time_filter}
            """,
            tuple(params),
        )
    return [dict(r) for r in rows]


def _score_to_signal(score: int) -> str | None:
    if score > 0:
        return None
    if score <= -2:
        return "hide"
    if score < 0:
        return "dislike"
    return "less_like_this"
