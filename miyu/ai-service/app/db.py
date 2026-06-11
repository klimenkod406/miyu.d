"""Лёгкая обёртка вокруг SQLite (тот же файл, что у backend).

Намеренно без ORM — пишем SQL руками, чтобы избежать конфликтов миграций
с backend. ORM добавим при переезде на Postgres.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterable

import numpy as np

from .config import get_settings


@contextmanager
def connect():
    settings = get_settings()
    path = Path(settings.db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=30.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    try:
        yield conn
    finally:
        conn.close()


def fetch_one(sql: str, params: Iterable[Any] = ()) -> sqlite3.Row | None:
    with connect() as c:
        cur = c.execute(sql, tuple(params))
        return cur.fetchone()


def fetch_all(sql: str, params: Iterable[Any] = ()) -> list[sqlite3.Row]:
    with connect() as c:
        cur = c.execute(sql, tuple(params))
        return cur.fetchall()


def execute(sql: str, params: Iterable[Any] = ()) -> int:
    with connect() as c:
        cur = c.execute(sql, tuple(params))
        return cur.lastrowid or 0


# ---- Embeddings <-> BLOB ----

def embedding_to_blob(vec: np.ndarray) -> bytes:
    return np.asarray(vec, dtype=np.float32).tobytes(order="C")


def blob_to_embedding(blob: bytes | None) -> np.ndarray | None:
    if not blob:
        return None
    return np.frombuffer(blob, dtype=np.float32)


# ---- JSON helpers ----

def to_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def from_json(value: str | None, default: Any = None) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default
