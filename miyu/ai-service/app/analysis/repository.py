"""Доступ к БД: чтение треков, запись результатов анализа и решений модерации."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import numpy as np

from .. import db
from .aggregator import ModerationDecision

logger = logging.getLogger(__name__)

GENRE_LABELS = {
    "rock": "Рок",
    "pop": "Поп",
    "electronic": "Электроника",
    "dance music": "Электроника",
    "house music": "Электроника",
    "techno": "Электроника",
    "trance": "Электроника",
    "drum and bass": "Электроника",
    "dubstep": "Электроника",
    "hip hop": "Хип-хоп",
    "rap": "Хип-хоп",
    "jazz": "Джаз",
    "classical music": "Классика",
    "indie rock": "Инди",
    "ambient music": "Эмбиент",
    "blues": "Блюз",
    "country": "Кантри",
    "reggae": "Регги",
    "folk music": "Фолк",
    "metal": "Метал",
    "punk rock": "Панк-рок",
    "r&b": "R&B",
    "soul music": "Соул",
    "lo-fi": "Lo-fi",
}

NON_GENRE_TAGS = {
    "speech",
    "male speech",
    "female speech",
    "conversation",
    "narration, monologue",
    "singing",
    "music",
    "background music",
    "silence",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _normalize_genre_label(value: str | None) -> str | None:
    if not value:
        return None
    raw = value.strip()
    if not raw:
        return None
    key = raw.lower()
    if key in NON_GENRE_TAGS:
        return None
    label = GENRE_LABELS.get(key)
    if label:
        return label
    return raw[:1].upper() + raw[1:]


def _genre_probability(item: dict[str, Any]) -> float:
    value = item.get("prob", 0)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _select_primary_genre(genre_tags: list[dict]) -> str | None:
    candidates: list[tuple[float, str]] = []
    for item in genre_tags:
        if not isinstance(item, dict):
            continue
        tag = item.get("tag")
        if not isinstance(tag, str):
            continue
        label = _normalize_genre_label(tag)
        if not label:
            continue
        candidates.append((_genre_probability(item), label))

    if not candidates:
        return None

    candidates.sort(key=lambda entry: entry[0], reverse=True)
    return candidates[0][1]


def _fallback_genre_from_features(features: dict) -> str:
    """Return a deterministic public genre when tagging assets are unavailable.

    PANNs may be skipped on CPU/VPS installs when its assets are absent. The
    product requirement is still to assign a genre after successful AI analysis,
    so use conservative audio-feature heuristics instead of leaving genre empty.
    """
    def number(name: str, default: float = 0.0) -> float:
        value = features.get(name)
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    bpm = number("bpm")
    energy = number("energy")
    danceability = number("danceability")
    acousticness = number("acousticness")
    instrumentalness = number("instrumentalness")
    speechiness = number("speechiness")

    if speechiness >= 0.48:
        return "Хип-хоп"
    if acousticness >= 0.72 and energy <= 0.45:
        return "Фолк"
    if instrumentalness >= 0.72 and energy <= 0.5:
        return "Эмбиент"
    if danceability >= 0.68 and (energy >= 0.58 or bpm >= 124):
        return "Электроника"
    if energy >= 0.78 and danceability < 0.6:
        return "Рок"
    if bpm <= 85 and energy <= 0.45:
        return "R&B"
    return "Поп"


def _select_public_genre(genre_tags: list[dict], features: dict) -> str:
    return _select_primary_genre(genre_tags) or _fallback_genre_from_features(features)


def get_track(track_id: int) -> dict | None:
    row = db.fetch_one(
        """
        SELECT t.id, t.artist_id, t.album_id, t.title, t.file_path, t.cover_url, t.lyrics,
               t.genre,
               u.is_verified AS artist_is_verified
        FROM tracks t
        JOIN users u ON u.id = t.artist_id
        WHERE t.id = ?
        """,
        (track_id,),
    )
    return dict(row) if row else None


def count_today_auto_approved(artist_id: int) -> int:
    row = db.fetch_one(
        """
        SELECT COUNT(*) AS cnt FROM tracks
        WHERE artist_id = ?
          AND status = 'approved'
          AND DATE(created_at) = DATE('now')
        """,
        (artist_id,),
    )
    return int(row["cnt"]) if row else 0


def upsert_track_analysis(
    track_id: int,
    *,
    features: dict,
    mood_tags: list[str],
    genre_tags: list[dict],
    audio_embedding: np.ndarray | None,
    text_embedding: np.ndarray | None,
    lyrics_text: str | None,
    lyrics_language: str | None,
    fingerprint: str | None,
    decision: ModerationDecision,
    summary: str,
    analysis_version: str,
    segments: list[dict] | None = None,
    structure: list[dict] | None = None,
) -> None:
    audio_blob = db.embedding_to_blob(audio_embedding) if audio_embedding is not None else None
    text_blob = db.embedding_to_blob(text_embedding) if text_embedding is not None else None
    primary_genre = _select_public_genre(genre_tags, features)

    segments_blob = db.to_json(segments) if segments else None
    structure_blob = db.to_json(structure) if structure else None

    db.execute(
        """
        INSERT INTO track_analysis (
            track_id, mood_tags, bpm, key, danceability, energy, valence,
            acousticness, instrumentalness, speechiness, loudness, genre_tags,
            audio_embedding, text_embedding, fingerprint, analysis_version,
            ai_score, ai_flags, lyrics_text, lyrics_language, segments_json, structure_json, analysis_summary,
            updated_at, created_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(
                (SELECT created_at FROM track_analysis WHERE track_id = ?), ?
            )
        )
        ON CONFLICT(track_id) DO UPDATE SET
            mood_tags = excluded.mood_tags,
            bpm = excluded.bpm,
            key = excluded.key,
            danceability = excluded.danceability,
            energy = excluded.energy,
            valence = excluded.valence,
            acousticness = excluded.acousticness,
            instrumentalness = excluded.instrumentalness,
            speechiness = excluded.speechiness,
            loudness = excluded.loudness,
            genre_tags = excluded.genre_tags,
            audio_embedding = excluded.audio_embedding,
            text_embedding = excluded.text_embedding,
            fingerprint = excluded.fingerprint,
            analysis_version = excluded.analysis_version,
            ai_score = excluded.ai_score,
            ai_flags = excluded.ai_flags,
            lyrics_text = excluded.lyrics_text,
            lyrics_language = excluded.lyrics_language,
            segments_json = excluded.segments_json,
            structure_json = excluded.structure_json,
            analysis_summary = excluded.analysis_summary,
            updated_at = excluded.updated_at
        """,
        (
            track_id,
            ",".join(mood_tags),
            features.get("bpm"),
            features.get("key"),
            features.get("danceability"),
            features.get("energy"),
            features.get("valence"),
            features.get("acousticness"),
            features.get("instrumentalness"),
            features.get("speechiness"),
            features.get("loudness"),
            db.to_json(genre_tags),
            audio_blob,
            text_blob,
            fingerprint,
            analysis_version,
            decision.ai_score,
            db.to_json(decision.ai_flags),
            lyrics_text,
            lyrics_language,
            segments_blob,
            structure_blob,
            summary,
            _now(),
            track_id,
            _now(),
        ),
    )

    update_track_public_fields(
        track_id,
        features=features,
        lyrics_text=lyrics_text,
        decision=decision,
        primary_genre=primary_genre,
    )


def update_track_public_fields(
    track_id: int,
    *,
    features: dict,
    lyrics_text: str | None,
    decision: ModerationDecision,
    primary_genre: str | None,
) -> None:
    """Синхронизировать публичные поля tracks после AI-анализа.

    `track_analysis` остаётся источником подробных признаков, но публичные страницы
    и плеер читают часть данных напрямую из `tracks`. Не перетираем ручные
    duration/lyrics/genre, зато обновляем технические BPM/key и explicit flag.
    """
    duration = features.get("duration_sec")
    duration_value = int(round(float(duration))) if duration else None
    bpm = features.get("bpm")
    bpm_value = int(round(float(bpm))) if bpm else None
    key = features.get("key")
    clean_lyrics = lyrics_text.strip() if isinstance(lyrics_text, str) and lyrics_text.strip() else None
    explicit_flags = {"explicit_lyrics", "explicit_heavy", "drug_reference", "hate_slur"}
    is_explicit = 1 if any(flag in explicit_flags for flag in decision.ai_flags) else 0

    db.execute(
        """
        UPDATE tracks
        SET
          duration = CASE
            WHEN ? IS NOT NULL AND (duration IS NULL OR duration <= 0) THEN ?
            ELSE duration
          END,
          bpm = COALESCE(?, bpm),
          key = COALESCE(?, key),
          lyrics = CASE
            WHEN ? IS NOT NULL AND (lyrics IS NULL OR TRIM(lyrics) = '') THEN ?
            ELSE lyrics
          END,
          is_explicit = CASE
            WHEN ? IS NOT NULL THEN ?
            ELSE is_explicit
          END,
          genre = CASE
            WHEN ? IS NOT NULL AND (genre IS NULL OR TRIM(genre) = '') THEN ?
            ELSE genre
          END,
          updated_at = ?
        WHERE id = ?
        """,
        (
            duration_value,
            duration_value,
            bpm_value,
            key,
            clean_lyrics,
            clean_lyrics,
            is_explicit,
            is_explicit,
            primary_genre,
            primary_genre,
            _now(),
            track_id,
        ),
    )


def apply_moderation_decision(
    track_id: int,
    submitted_by: int,
    decision: ModerationDecision,
    *,
    auto_approve_limit_reached: bool,
) -> str:
    """Применить решение к таблицам tracks и moderation_queue.

    Возвращает финальный статус ('approved' | 'pending' | 'ai_flagged').
    """
    if decision.decision == "approve" and not auto_approve_limit_reached:
        final_status = "approved"
        track_status = "approved"
        priority = "low"
    elif decision.decision == "flag":
        final_status = "ai_flagged"
        track_status = "pending"
        priority = "high"
    else:
        final_status = "pending"
        track_status = "pending"
        priority = "normal"

    db.execute("UPDATE tracks SET status = ?, updated_at = ? WHERE id = ?",
               (track_status, _now(), track_id))

    # moderation_queue: создаём запись (для аудита) даже при auto-approve
    existing = db.fetch_one(
        "SELECT id FROM moderation_queue WHERE content_type = 'track' AND content_id = ?",
        (track_id,),
    )
    flags_json = db.to_json(decision.ai_flags)
    if existing:
        db.execute(
            """UPDATE moderation_queue
               SET status = ?, ai_score = ?, ai_flags = ?, priority = ?
               WHERE id = ?""",
            (final_status, decision.ai_score, flags_json, priority, existing["id"]),
        )
    else:
        db.execute(
            """INSERT INTO moderation_queue
               (content_type, content_id, submitted_by, status, ai_score, ai_flags, priority)
               VALUES ('track', ?, ?, ?, ?, ?, ?)""",
            (track_id, submitted_by, final_status, decision.ai_score, flags_json, priority),
        )

    return final_status
