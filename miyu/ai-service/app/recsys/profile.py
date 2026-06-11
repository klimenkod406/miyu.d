"""Построение профиля вкуса пользователя — `user_taste_profile`.

Формула весов (зафиксировано в docs/AI_ARCHITECTURE.md §3.2):

    w(track) = 3.0 * like
             + 2.0 * in_user_playlist
             + 1.5 * follow_artist
             + 1.0 * completed_play_count
             + 0.3 * partial_play_count
             + 1.0 * video_completed_count
             + 0.3 * video_partial_count
             - 1.5 * explicit_dislike
             - 0.8 * early_skip_count

Каждое событие умножается на `decay = 0.5 ** (days_old / 30)` (half-life 30 дней).

`taste_embedding = Σ w_i * audio_embedding_i / Σ w_i` (по трекам с w_i > 0).
"""
from __future__ import annotations

import json
import logging
import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable

import numpy as np

from .. import db
from . import feedback_store

logger = logging.getLogger(__name__)

# --- Константы (зафиксировано) ---
HALF_LIFE_DAYS = 30.0
WEIGHT_LIKE = 3.0
WEIGHT_PLAYLIST = 2.0
WEIGHT_FOLLOW_ARTIST = 1.5
WEIGHT_COMPLETED_PLAY = 1.0
WEIGHT_PARTIAL_PLAY = 0.3
WEIGHT_VIDEO_COMPLETED = 1.0
WEIGHT_VIDEO_PARTIAL = 0.3
WEIGHT_EXPLICIT_DISLIKE = -1.5
WEIGHT_EARLY_SKIP = -0.8

# Skip < 10 сек = «ранний скип». Применяется только если трек впервые встречен пользователю.
EARLY_SKIP_SECONDS = 10

# Окно сбора сигналов: ~6 half-lives (мы всё равно затухаем).
LOOKBACK_DAYS = 180

PROFILE_VERSION = "v1"


# --------------------------------------------------------------- helpers ---

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    # SQLite хранит обычно "YYYY-MM-DD HH:MM:SS" (UTC) или ISO с Z/таймзоной.
    s = s.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        try:
            dt = datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def time_decay(event_dt: datetime | None, now: datetime | None = None) -> float:
    """Экспоненциальное затухание `0.5 ** (days_old / HALF_LIFE_DAYS)`.

    Возвращает 1.0 для свежих, 0.5 через 30 дней, ≈0.06 через 120 дней.
    Если `event_dt` неизвестна → 1.0 (не штрафуем за отсутствие времени).
    """
    if event_dt is None:
        return 1.0
    now = now or _now_utc()
    days_old = max(0.0, (now - event_dt).total_seconds() / 86400.0)
    return 0.5 ** (days_old / HALF_LIFE_DAYS)


# ---------------------------------------------------------- signal model ---

@dataclass
class TrackSignal:
    """Сводка взаимодействий пользователя с одним треком."""
    weight: float = 0.0  # \u0418\u0442\u043e\u0433\u043e\u0432\u044b\u0439 \u0432\u0435\u0441 (\u0441\u043e \u0432\u0441\u0435\u043c\u0438 decay).
    raw_events: int = 0  # \u0421\u043a\u043e\u043b\u044c\u043a\u043e \u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u0443\u0447\u0442\u0435\u043d\u043e (\u0431\u0435\u0437 decay).

    def add(self, w: float, count: int = 1) -> None:
        self.weight += w
        self.raw_events += count


def aggregate_signals(
    likes: Iterable[tuple[int, str | None]] = (),
    playlists: Iterable[tuple[int, str | None]] = (),
    follows_artist_tracks: Iterable[tuple[int, str | None]] = (),
    plays_completed: Iterable[tuple[int, str | None]] = (),
    plays_partial: Iterable[tuple[int, str | None]] = (),
    videos_completed: Iterable[tuple[int, str | None]] = (),
    videos_partial: Iterable[tuple[int, str | None]] = (),
    explicit_dislikes: Iterable[tuple[int, str | None]] = (),
    early_skips: Iterable[tuple[int, str | None]] = (),
    now: datetime | None = None,
) -> dict[int, TrackSignal]:
    """Сворачивает события в суммарный вес на трек.

    Все iter-ы — это последовательности `(track_id, created_at_str)`.
    Чистая функция без БД — удобно тестировать.
    """
    now = now or _now_utc()
    signals: dict[int, TrackSignal] = defaultdict(TrackSignal)

    def add_events(events: Iterable[tuple[int, str | None]], weight_per_event: float) -> None:
        for tid, ts in events:
            decay = time_decay(_parse_dt(ts), now)
            signals[int(tid)].add(weight_per_event * decay, 1)

    add_events(likes, WEIGHT_LIKE)
    add_events(playlists, WEIGHT_PLAYLIST)
    add_events(follows_artist_tracks, WEIGHT_FOLLOW_ARTIST)
    add_events(plays_completed, WEIGHT_COMPLETED_PLAY)
    add_events(plays_partial, WEIGHT_PARTIAL_PLAY)
    add_events(videos_completed, WEIGHT_VIDEO_COMPLETED)
    add_events(videos_partial, WEIGHT_VIDEO_PARTIAL)
    add_events(explicit_dislikes, WEIGHT_EXPLICIT_DISLIKE)
    add_events(early_skips, WEIGHT_EARLY_SKIP)

    return signals


def top_positive_track_ids(signals: dict[int, TrackSignal], limit: int = 20) -> list[int]:
    """Возвращает top-N seed tracks по положительному весу сигнала."""
    ranked = sorted(
        ((tid, sig) for tid, sig in signals.items() if sig.weight > 0),
        key=lambda item: (-item[1].weight, -item[1].raw_events, item[0]),
    )
    return [tid for tid, _ in ranked[:limit]]


# ---------------------------------------------------- centroid + summary ---

@dataclass
class ProfileResult:
    user_id: int
    interactions_count: int
    taste_embedding: np.ndarray | None
    top_genres: list[dict]            # [{tag, weight}]
    top_moods: list[dict]
    bpm_mean: float | None
    bpm_std: float | None
    energy_mean: float | None
    valence_mean: float | None
    danceability_mean: float | None
    diversity: float | None
    profile_version: str = PROFILE_VERSION


def compute_centroid(
    signals: dict[int, TrackSignal],
    embeddings: dict[int, np.ndarray],
) -> tuple[np.ndarray | None, float]:
    """Взвешенный центроид + diversity (среднее косинус-расстояние от центроида).

    Учитываем только треки с положительным весом и доступным эмбеддингом.
    """
    keys = [tid for tid, s in signals.items() if s.weight > 0 and tid in embeddings]
    if not keys:
        return None, 0.0
    dim = embeddings[keys[0]].shape[0]
    matrix = np.zeros((len(keys), dim), dtype=np.float32)
    weights = np.zeros(len(keys), dtype=np.float32)
    for i, tid in enumerate(keys):
        emb = embeddings[tid]
        if emb.shape[0] != dim:
            continue
        matrix[i] = emb
        weights[i] = signals[tid].weight
    total_w = float(weights.sum())
    if total_w <= 0:
        return None, 0.0
    centroid = (matrix.T @ weights) / total_w  # (dim,)
    # Diversity: \u0441\u0440\u0435\u0434\u043d\u0435\u0435 \u043a\u043e\u0441\u0438\u043d\u0443\u0441-\u0440\u0430\u0441\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u043e\u0442 \u0432\u0437\u0432\u0435\u0448\u0435\u043d\u043d\u043e\u0433\u043e \u0446\u0435\u043d\u0442\u0440\u043e\u0438\u0434\u0430.
    cn = np.linalg.norm(centroid) + 1e-9
    en = np.linalg.norm(matrix, axis=1) + 1e-9
    cosines = (matrix @ centroid) / (en * cn)
    weighted_distance = float(((1.0 - cosines) * weights).sum() / total_w)
    return centroid.astype(np.float32), max(0.0, min(1.0, weighted_distance))


# ---------------------------------------------------- DB-side ingestion ---

def _fetch_signals(user_id: int) -> dict[int, TrackSignal]:
    """\u0427\u0438\u0442\u0430\u0435\u0442 \u0432\u0441\u0435 \u0441\u0438\u0433\u043d\u0430\u043b\u044b \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0438\u0437 \u0411\u0414, \u043f\u0440\u0438\u043c\u0435\u043d\u044f\u0435\u0442 \u0444\u043e\u0440\u043c\u0443\u043b\u0443 + decay."""
    cutoff = (_now_utc().timestamp() - LOOKBACK_DAYS * 86400)
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    likes = [
        (r["track_id"], r["created_at"])
        for r in db.fetch_all(
            "SELECT track_id, created_at FROM likes WHERE user_id = ? AND created_at >= ?",
            (user_id, cutoff_iso),
        )
    ]
    playlists = [
        (r["track_id"], r["added_at"])
        for r in db.fetch_all(
            """
            SELECT pt.track_id, pt.added_at
            FROM playlist_tracks pt
            JOIN playlists p ON p.id = pt.playlist_id
            WHERE p.user_id = ? AND pt.added_at >= ?
            """,
            (user_id, cutoff_iso),
        )
    ]
    follows_artist_tracks = [
        (r["track_id"], r["follow_at"])
        for r in db.fetch_all(
            """
            SELECT t.id AS track_id, af.created_at AS follow_at
            FROM artist_follows af
            JOIN tracks t ON t.artist_id = af.artist_id
            WHERE af.user_id = ? AND af.created_at >= ? AND t.status = 'approved'
            """,
            (user_id, cutoff_iso),
        )
    ]

    plays_completed: list[tuple[int, str | None]] = []
    plays_partial: list[tuple[int, str | None]] = []
    early_skips: list[tuple[int, str | None]] = []
    # \u0414\u043b\u044f early_skip \u043d\u0443\u0436\u043d\u043e \u043f\u043e\u043d\u044f\u0442\u044c, \u0431\u044b\u043b \u043b\u0438 \u0442\u0440\u0435\u043a \u00ab\u043d\u0435\u0437\u043d\u0430\u043a\u043e\u043c\u044b\u043c\u00bb \u043d\u0430 \u043c\u043e\u043c\u0435\u043d\u0442 \u044d\u0442\u043e\u0433\u043e \u043f\u043b\u0435\u044f.
    # \u0423\u043f\u0440\u043e\u0449\u0435\u043d\u0438\u0435: \u00ab\u043d\u0435\u0437\u043d\u0430\u043a\u043e\u043c\u044b\u0439\u00bb \u2261 \u0443 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u044d\u0442\u043e \u043f\u0435\u0440\u0432\u044b\u0439 \u043f\u043b\u0435\u0439 \u044d\u0442\u043e\u0433\u043e \u0442\u0440\u0435\u043a\u0430 \u0432 \u0432\u044b\u0431\u043e\u0440\u043a\u0435.
    seen_track_ids: set[int] = set()
    for r in db.fetch_all(
        """
        SELECT track_id, completed, play_duration, COALESCE(played_at, created_at) AS at
        FROM track_plays
        WHERE user_id = ? AND COALESCE(played_at, created_at) >= ?
        ORDER BY COALESCE(played_at, created_at) ASC
        """,
        (user_id, cutoff_iso),
    ):
        tid = int(r["track_id"])
        ts = r["at"]
        if r["completed"]:
            plays_completed.append((tid, ts))
        else:
            plays_partial.append((tid, ts))
            # early skip — только если незнаком
            if r["play_duration"] is not None and int(r["play_duration"]) < EARLY_SKIP_SECONDS and tid not in seen_track_ids:
                early_skips.append((tid, ts))
        seen_track_ids.add(tid)

    videos_completed: list[tuple[int, str | None]] = []
    videos_partial: list[tuple[int, str | None]] = []
    for r in db.fetch_all(
        """
        SELECT v.track_id, vv.completed, vv.created_at AS at
        FROM video_views vv
        JOIN videos v ON v.id = vv.video_id
        WHERE vv.user_id = ? AND vv.created_at >= ? AND v.track_id IS NOT NULL
        """,
        (user_id, cutoff_iso),
    ):
        if r["track_id"] is None:
            continue
        tid = int(r["track_id"])
        if r["completed"]:
            videos_completed.append((tid, r["at"]))
        else:
            videos_partial.append((tid, r["at"]))

    explicit_dislikes = [
        (int(r["target_id"]), r.get("created_at"))
        for r in feedback_store.negative_feedback_rows(user_id, "track", cutoff_iso)
        if r.get("target_id") is not None
    ]

    return aggregate_signals(
        likes=likes,
        playlists=playlists,
        follows_artist_tracks=follows_artist_tracks,
        plays_completed=plays_completed,
        plays_partial=plays_partial,
        videos_completed=videos_completed,
        videos_partial=videos_partial,
        explicit_dislikes=explicit_dislikes,
        early_skips=early_skips,
    )


def _fetch_track_features(track_ids: Iterable[int]) -> tuple[dict[int, np.ndarray], dict[int, dict]]:
    """\u0420\u0435\u0432\u0435\u0440\u0441\u0438\u0432\u043d\u044b\u0439 \u043b\u043e\u0430\u0434 audio_embedding + audio features \u0434\u043b\u044f \u0442\u0440\u0435\u043a\u043e\u0432."""
    track_ids = list({int(t) for t in track_ids})
    if not track_ids:
        return {}, {}
    placeholders = ",".join("?" * len(track_ids))
    rows = db.fetch_all(
        f"""
        SELECT track_id, audio_embedding, mood_tags, genre_tags, bpm,
               energy, valence, danceability
        FROM track_analysis
        WHERE track_id IN ({placeholders})
        """,
        tuple(track_ids),
    )
    embs: dict[int, np.ndarray] = {}
    feats: dict[int, dict] = {}
    for r in rows:
        tid = int(r["track_id"])
        emb = db.blob_to_embedding(r["audio_embedding"])
        if emb is not None and emb.size:
            embs[tid] = emb
        feats[tid] = {
            "mood_tags": r["mood_tags"],
            "genre_tags": r["genre_tags"],
            "bpm": r["bpm"],
            "energy": r["energy"],
            "valence": r["valence"],
            "danceability": r["danceability"],
        }
    return embs, feats


def _aggregate_tags_and_features(
    signals: dict[int, TrackSignal],
    feats: dict[int, dict],
) -> tuple[list[dict], list[dict], dict[str, float | None]]:
    """\u0422\u043e\u043f-\u0436\u0430\u043d\u0440\u044b/mood (\u0432\u0437\u0432\u0435\u0448\u0435\u043d\u043d\u043e) + \u0441\u0440\u0435\u0434\u043d\u0438\u0435 \u0430\u0443\u0434\u0438\u043e-\u043f\u0440\u0438\u0437\u043d\u0430\u043a\u0438."""
    genre_w: dict[str, float] = defaultdict(float)
    mood_w: dict[str, float] = defaultdict(float)
    bpm_vals: list[tuple[float, float]] = []   # (value, weight)
    energy_vals: list[tuple[float, float]] = []
    valence_vals: list[tuple[float, float]] = []
    dance_vals: list[tuple[float, float]] = []

    for tid, sig in signals.items():
        if sig.weight <= 0:
            continue
        f = feats.get(tid)
        if not f:
            continue
        # genre_tags JSON — список {tag, prob}
        try:
            genres = json.loads(f["genre_tags"]) if f["genre_tags"] else []
        except (TypeError, ValueError):
            genres = []
        for g in genres or []:
            tag = g.get("tag") if isinstance(g, dict) else str(g)
            prob = float(g.get("prob", 1.0)) if isinstance(g, dict) else 1.0
            if tag:
                genre_w[tag] += sig.weight * prob
        # mood_tags — comma-separated
        moods_raw = f.get("mood_tags") or ""
        for m in str(moods_raw).split(","):
            m = m.strip()
            if m:
                mood_w[m] += sig.weight
        # \u0427\u0438\u0441\u043b\u043e\u0432\u044b\u0435 \u043f\u0440\u0438\u0437\u043d\u0430\u043a\u0438
        if f.get("bpm") is not None:
            bpm_vals.append((float(f["bpm"]), sig.weight))
        if f.get("energy") is not None:
            energy_vals.append((float(f["energy"]), sig.weight))
        if f.get("valence") is not None:
            valence_vals.append((float(f["valence"]), sig.weight))
        if f.get("danceability") is not None:
            dance_vals.append((float(f["danceability"]), sig.weight))

    def weighted_mean(vals: list[tuple[float, float]]) -> float | None:
        if not vals:
            return None
        sw = sum(w for _, w in vals)
        if sw <= 0:
            return None
        return sum(v * w for v, w in vals) / sw

    def weighted_std(vals: list[tuple[float, float]], mean: float | None) -> float | None:
        if not vals or mean is None:
            return None
        sw = sum(w for _, w in vals)
        if sw <= 0:
            return None
        var = sum(w * (v - mean) ** 2 for v, w in vals) / sw
        return math.sqrt(max(0.0, var))

    bpm_mean = weighted_mean(bpm_vals)
    summary = {
        "bpm_mean": bpm_mean,
        "bpm_std": weighted_std(bpm_vals, bpm_mean),
        "energy_mean": weighted_mean(energy_vals),
        "valence_mean": weighted_mean(valence_vals),
        "danceability_mean": weighted_mean(dance_vals),
    }

    top_genres = [
        {"tag": tag, "weight": round(w, 4)}
        for tag, w in sorted(genre_w.items(), key=lambda kv: -kv[1])[:10]
    ]
    top_moods = [
        {"tag": tag, "weight": round(w, 4)}
        for tag, w in sorted(mood_w.items(), key=lambda kv: -kv[1])[:10]
    ]
    return top_genres, top_moods, summary


# ----------------------------------------------------- public entry point ---

def rebuild_user_profile(user_id: int) -> ProfileResult:
    """\u041f\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u044b\u0432\u0430\u0435\u0442 \u0441\u043d\u0430\u043f\u0448\u043e\u0442 \u0432\u043a\u0443\u0441\u043e\u0432\u043e\u0433\u043e \u043f\u0440\u043e\u0444\u0438\u043b\u044f \u0438 \u043f\u0438\u0448\u0435\u0442 \u0432 user_taste_profile."""
    signals = _fetch_signals(user_id)
    interactions_count = sum(s.raw_events for s in signals.values() if s.weight > 0)

    embs, feats = _fetch_track_features(signals.keys())
    centroid, diversity = compute_centroid(signals, embs)
    top_genres, top_moods, summary = _aggregate_tags_and_features(signals, feats)

    result = ProfileResult(
        user_id=user_id,
        interactions_count=interactions_count,
        taste_embedding=centroid,
        top_genres=top_genres,
        top_moods=top_moods,
        bpm_mean=summary["bpm_mean"],
        bpm_std=summary["bpm_std"],
        energy_mean=summary["energy_mean"],
        valence_mean=summary["valence_mean"],
        danceability_mean=summary["danceability_mean"],
        diversity=diversity if centroid is not None else None,
    )

    db.execute(
        """
        INSERT INTO user_taste_profile (
            user_id, taste_embedding, top_genres, top_moods,
            bpm_mean, bpm_std, energy_mean, valence_mean, danceability_mean,
            diversity, interactions_count, profile_version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            taste_embedding=excluded.taste_embedding,
            top_genres=excluded.top_genres,
            top_moods=excluded.top_moods,
            bpm_mean=excluded.bpm_mean,
            bpm_std=excluded.bpm_std,
            energy_mean=excluded.energy_mean,
            valence_mean=excluded.valence_mean,
            danceability_mean=excluded.danceability_mean,
            diversity=excluded.diversity,
            interactions_count=excluded.interactions_count,
            profile_version=excluded.profile_version,
            updated_at=CURRENT_TIMESTAMP
        """,
        (
            user_id,
            db.embedding_to_blob(centroid) if centroid is not None else None,
            json.dumps(top_genres, ensure_ascii=False),
            json.dumps(top_moods, ensure_ascii=False),
            summary["bpm_mean"],
            summary["bpm_std"],
            summary["energy_mean"],
            summary["valence_mean"],
            summary["danceability_mean"],
            result.diversity,
            interactions_count,
            PROFILE_VERSION,
        ),
    )
    logger.info(
        "rebuilt taste profile user=%d interactions=%d centroid=%s genres=%d",
        user_id, interactions_count, "yes" if centroid is not None else "no", len(top_genres),
    )
    return result


def get_profile(user_id: int) -> dict | None:
    """\u0427\u0438\u0442\u0430\u0435\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c (\u0431\u0435\u0437 \u043f\u0435\u0440\u0435\u0441\u0431\u043e\u0440\u0430)."""
    row = db.fetch_one(
        "SELECT * FROM user_taste_profile WHERE user_id = ?",
        (user_id,),
    )
    if row is None:
        return None
    return {
        "user_id": int(row["user_id"]),
        "taste_embedding": db.blob_to_embedding(row["taste_embedding"]),
        "top_genres": json.loads(row["top_genres"]) if row["top_genres"] else [],
        "top_moods": json.loads(row["top_moods"]) if row["top_moods"] else [],
        "bpm_mean": row["bpm_mean"],
        "bpm_std": row["bpm_std"],
        "energy_mean": row["energy_mean"],
        "valence_mean": row["valence_mean"],
        "danceability_mean": row["danceability_mean"],
        "diversity": row["diversity"],
        "interactions_count": int(row["interactions_count"] or 0),
        "profile_version": row["profile_version"],
        "updated_at": row["updated_at"],
    }


def get_seed_track_ids(user_id: int, limit: int = 20) -> list[int]:
    """Top-N позитивных seed tracks для candidate generation."""
    return top_positive_track_ids(_fetch_signals(user_id), limit=limit)
