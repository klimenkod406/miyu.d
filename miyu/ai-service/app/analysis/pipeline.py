"""Полный пайплайн анализа трека (Фаза 1 MVP).

Вызов: `analyze_track(track_id)` или `analyze_track(track_id, file_path=...)`.
Шаги:
  1. Pre-flight (длительность, валидность аудио)
  2. Аудио-признаки (librosa)
  3. Tagging + audio embedding (PANNs)
  4. Транскрипция (faster-whisper)
  5. Текстовая модерация (9 категорий: мат, секс, наркотики, насилие...) + text embed
  6. NSFW-обложка (opennsfw2)
  7. Fingerprint (chromaprint) + дубликаты
  8. Aggregator → ai_score / ai_flags / decision
  9. Запись в track_analysis + tracks/moderation_queue

Каждый шаг обёрнут в try/except: единичная ошибка модели не валит весь пайплайн.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from ..config import get_settings
from . import (
    aggregator,
    audio_features,
    duplicates,
    fingerprint,
    image_moderation,
    repository,
    tagging,
    text_moderation,
    transcription,
    structure,
)

logger = logging.getLogger(__name__)


def _resolve_path(file_path: str) -> Path:
    """Нормализует путь к файлу относительно storage_root."""
    p = Path(file_path)
    if p.is_absolute() and p.exists():
        return p
    root = get_settings().storage_root
    candidate = root / file_path.lstrip("/").lstrip("\\")
    if candidate.exists():
        return candidate
    # Пробуем относительно tracks/
    candidate2 = root / "tracks" / Path(file_path).name
    if candidate2.exists():
        return candidate2
    return p  # вернём исходный (вызовет ошибку дальше)


_GENRE_PROMPTS = {
    "rock": "Rock song lyrics with guitar and drums.",
    "рок": "Rock song lyrics with guitar and drums.",
    "rap": "Rap lyrics, hip-hop music with rhymes.",
    "hip hop": "Rap lyrics, hip-hop music with rhymes.",
    "хип-хоп": "Rap lyrics, hip-hop music with rhymes.",
    "pop": "Pop song lyrics with chorus and verse.",
    "поп": "Pop song lyrics with chorus and verse.",
    "electronic": "Electronic music with vocals.",
    "электроника": "Electronic music with vocals.",
    "metal": "Metal song lyrics with heavy guitars.",
    "метал": "Metal song lyrics with heavy guitars.",
}


def _lyrics_initial_prompt(track: dict[str, Any], genre_tags: list[dict]) -> str:
    for tag in genre_tags:
        genre = str(tag.get("tag") or "").strip().lower()
        if genre in _GENRE_PROMPTS:
            return _GENRE_PROMPTS[genre]

    track_genre = str(track.get("genre") or "").strip().lower()
    return _GENRE_PROMPTS.get(track_genre, "Song lyrics with music background.")


def analyze_track(track_id: int, file_path: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    track = repository.get_track(track_id)
    if track is None:
        raise ValueError(f"track {track_id} not found")

    audio_path = _resolve_path(file_path or track["file_path"])
    if not audio_path.exists():
        raise FileNotFoundError(f"audio file not found: {audio_path}")

    flags_extra: list[str] = []

    # --- 1. Аудио-признаки + pre-flight ---
    invalid_audio = False
    try:
        feats = audio_features.extract(str(audio_path))
        if feats.duration_sec < 20 or feats.duration_sec > 20 * 60:
            invalid_audio = True
            flags_extra.append("invalid_audio")
        features_dict = feats.asdict()
    except Exception as e:
        logger.exception("audio_features failed: %s", e)
        invalid_audio = True
        features_dict = {
            "bpm": None, "key": None, "loudness": None, "energy": None,
            "danceability": None, "valence": None, "acousticness": None,
            "instrumentalness": None, "speechiness": None,
            "duration_sec": 0.0, "sample_rate": 0,
        }

    # --- 2. Tagging + audio embedding ---
    mood_tags: list[str] = []
    genre_tags: list[dict] = []
    audio_emb = None
    if not invalid_audio:
        try:
            tag_out = tagging.predict(str(audio_path))
            mood_tags = tag_out["mood_tags"]
            genre_tags = tag_out["genre_tags"]
            audio_emb = tag_out["embedding"]
        except Exception as e:
            logger.exception("tagging failed: %s", e)

    # --- 3. Транскрипция ---
    lyrics_text: str | None = None
    lyrics_language: str | None = None
    lyrics_segments: list[dict] | None = None
    if not invalid_audio:
        try:
            initial_prompt = _lyrics_initial_prompt(track, genre_tags)
            tr = transcription.transcribe(str(audio_path), initial_prompt=initial_prompt)
            lyrics_text = tr.get("text") or None
            lyrics_language = tr.get("language")
            lyrics_segments = tr.get("segments")
        except Exception as e:
            logger.exception("transcription failed: %s", e)

    manual_lyrics = str(track.get("lyrics") or "").strip()
    recognized_lyrics = (lyrics_text or "").strip()
    if manual_lyrics and recognized_lyrics:
        best_lyrics_text = recognized_lyrics if len(recognized_lyrics) >= len(manual_lyrics) * 0.85 else manual_lyrics
        moderation_text = "\n".join([recognized_lyrics, manual_lyrics])
    else:
        best_lyrics_text = recognized_lyrics or manual_lyrics or None
        moderation_text = best_lyrics_text or ""

    if manual_lyrics and (not recognized_lyrics or best_lyrics_text == manual_lyrics):
        lyrics_language = lyrics_language or "manual"
        if not lyrics_segments:
            lyrics_segments = [
                {"start": 0.0, "end": 0.0, "text": line.strip()}
                for line in manual_lyrics.splitlines()
                if line.strip()
            ]

    lyrics_text = best_lyrics_text

    # --- 3.4. Sentence-level segment splitting ---
    if lyrics_segments and not invalid_audio:
        try:
            sentence_segments = structure.split_segments_by_sentences(lyrics_segments)
            if sentence_segments:
                lyrics_segments = sentence_segments
        except Exception as e:
            logger.exception("sentence splitting failed: %s", e)

    # --- 3.5. Структурная сегментация ---
    track_structure: list[dict] | None = None
    if lyrics_segments and not invalid_audio:
        try:
            track_structure = structure.analyze(
                lyrics_segments, features_dict, features_dict.get("duration_sec", 0.0),
            )
        except Exception as e:
            logger.exception("structure analysis failed: %s", e)
    # --- 4. Текстовая модерация + embedding ---
    moderation_result = text_moderation.ModerationResult()
    text_emb = None
    if moderation_text:
        try:
            moderation_result = text_moderation.analyze(moderation_text)
        except Exception as e:
            logger.exception("text moderation failed: %s", e)
        try:
            text_emb = text_moderation.embed(moderation_text)
        except Exception as e:
            logger.exception("text embed failed: %s", e)
    # --- 5. NSFW-обложка (если есть) ---
    nsfw_cover_score = 0.0
    cover = track.get("cover_url")
    if cover:
        cover_path = _resolve_path(cover)
        if cover_path.exists():
            try:
                nsfw_cover_score = image_moderation.nsfw_score(str(cover_path))
            except Exception as e:
                logger.exception("nsfw image failed: %s", e)

    # --- 6. Fingerprint + дубликаты ---
    fp_str: str | None = None
    possible_dup = False
    dup_score = 0.0
    if not invalid_audio:
        try:
            fp_str = fingerprint.compute(str(audio_path))
        except Exception as e:
            logger.exception("fingerprint failed: %s", e)
        if audio_emb is not None:
            try:
                dup_id, dup_score = duplicates.find_duplicate_by_embedding(
                    audio_emb, exclude_track_id=track_id
                )
                if dup_id is not None and dup_score >= duplicates.DUP_EMB_THRESHOLD:
                    possible_dup = True
            except Exception as e:
                logger.exception("duplicate search failed: %s", e)
        if not possible_dup and fp_str:
            try:
                if duplicates.find_duplicate_by_fingerprint(fp_str, exclude_track_id=track_id):
                    possible_dup = True
                    dup_score = max(dup_score, 0.9)
            except Exception as e:
                logger.exception("fp dup failed: %s", e)

    # --- 7. Aggregator ---
    signals = aggregator.ModerationSignals(
        is_18plus=moderation_result.is_18plus,
        mmr_score=moderation_result.mmr_score,
        density=moderation_result.density,
        total_hits=moderation_result.total_hits,
        categories=moderation_result.categories,
        has_red_flag=moderation_result.has_red_flag,
        nsfw_cover=nsfw_cover_score,
        invalid_audio=invalid_audio,
        possible_duplicate=possible_dup,
        duplicate_score=dup_score,
        artist_is_verified=bool(track.get("artist_is_verified")),
    )
    decision = aggregator.aggregate(signals)
    # Дополним красные флаги, выявленные на этапах
    for f in flags_extra:
        if f not in decision.ai_flags:
            decision.ai_flags.append(f)

    # --- 8. Лимит auto-approve на артиста (отключён по решению проекта: limit=0) ---
    auto_limit_reached = False
    if decision.decision == "approve" and settings.auto_approve_daily_limit > 0:
        cnt_today = repository.count_today_auto_approved(int(track["artist_id"]))
        if cnt_today >= settings.auto_approve_daily_limit:
            auto_limit_reached = True

    # --- 9. Запись результатов ---
    summary_parts = []
    if features_dict.get("bpm"):
        summary_parts.append(f"BPM={features_dict['bpm']}")
    if features_dict.get("key"):
        summary_parts.append(f"key={features_dict['key']}")
    if mood_tags:
        summary_parts.append("mood=" + "/".join(mood_tags))
    if decision.ai_flags:
        summary_parts.append("flags=" + ",".join(decision.ai_flags))
    summary = "; ".join(summary_parts) or "n/a"

    repository.upsert_track_analysis(
        track_id,
        features=features_dict,
        mood_tags=mood_tags,
        genre_tags=genre_tags,
        audio_embedding=audio_emb,
        text_embedding=text_emb,
        lyrics_text=lyrics_text,
        lyrics_language=lyrics_language,
        fingerprint=fp_str,
        decision=decision,
        summary=summary,
        analysis_version=settings.analysis_version,
        segments=lyrics_segments,
        structure=track_structure,
    )

    final_status = repository.apply_moderation_decision(
        track_id,
        submitted_by=int(track["artist_id"]),
        decision=decision,
        auto_approve_limit_reached=auto_limit_reached,
    )

    return {
        "track_id": track_id,
        "ai_score": decision.ai_score,
        "ai_flags": decision.ai_flags,
        "decision": decision.decision,
        "final_status": final_status,
        "auto_approve_limit_reached": auto_limit_reached,
        "features": features_dict,
        "mood_tags": mood_tags,
        "genre_tags": genre_tags,
        "lyrics_language": lyrics_language,
        "lyrics_chars": len(lyrics_text or ""),
        "duplicate_score": dup_score,
        "nsfw_cover_score": nsfw_cover_score,
        "summary": summary,
    }
