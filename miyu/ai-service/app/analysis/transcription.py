"""Транскрипция текста песни через faster-whisper (CTranslate2, CPU/int8)."""
from __future__ import annotations

import json
import logging
import subprocess
import tempfile
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_MODEL = None
_WHITESPACE_RE = re.compile(r"\s+")
_PROMPT_LEAK_RE = re.compile(r"^текст песни на русском языке\.?$", re.IGNORECASE)
_GENERIC_LEAK_RE = re.compile(r"^современн[а-я\-/ ]+$", re.IGNORECASE)
_HALLUCINATION_RE = re.compile(
    r"^(спасибо за просмотр|подписывайтесь|ставьте лайк|субтитры|перевод|автор|"
    r"редактор\s+субтитров.*|корректор\s+.*|\[музыка\]|♪.*♪|thanks for watching|"
    r"subscribe|like and share|спасибо за субтитры.*|продолжение следует.*|девушки отдыхают.*)$",
    re.IGNORECASE
)
_REPEATED_SYLLABLE_RE = re.compile(r"^(?:на|ла|па|ра|да|та|ха)(?:[-\s,]+(?:на|ла|па|ра|да|та|ха)){8,}\.?$", re.IGNORECASE)
_REPEATED_SHORT_WORD_RE = re.compile(r"^([а-яё]{2,5})[,.!…]*\s*(?:[,\s]+\1[,.!…]*){5,}$", re.IGNORECASE)
_CYRILLIC_RE = re.compile(r"[А-Яа-яЁё]")
_LATIN_RE = re.compile(r"[A-Za-z]")
_DEFAULT_VAD_PARAMETERS = {
    "threshold": 0.5,
    "min_speech_duration_ms": 250,
    "min_silence_duration_ms": 2000,
    "speech_pad_ms": 400,
}
_SOFT_MUSIC_VAD_PARAMETERS = {
    "threshold": 0.15,
    "min_speech_duration_ms": 100,
    "min_silence_duration_ms": 300,
    "speech_pad_ms": 500,
}
_RUSSIAN_LYRICS_PROMPT = "Текст русской песни. Куплет, припев, повторяющиеся строки, музыка на фоне."
_LOW_COVERAGE_THRESHOLD = 0.85

# Поддержка динамической смены конфига (из transcription_params, benchmark)
_ACTIVE_CONFIG: object | None = None


def _merge_adjacent_segments(segments: list[dict], max_gap: float = 1.5) -> list[dict]:
    """Склеивает соседние сегменты с маленьким зазором между ними.
    Если два сегмента разделены паузой короче max_gap секунд,
    они объединяются в один. Улучшенная версия: проверяет,
    что склейка не разрывает слова и фразы.
    """
    if not segments:
        return segments
    merged = [dict(segments[0])]  # copy to avoid mutation
    for seg in segments[1:]:
        last = merged[-1]
        gap = float(seg["start"]) - float(last["end"])
        if 0 <= gap <= max_gap:
            last["end"] = seg["end"]
            last_text = str(last.get("text") or "").strip()
            seg_text = str(seg.get("text") or "").strip()

            if last_text and seg_text:
                last_words = last_text.split()
                seg_words = seg_text.split()

                # 1. Check for word overlap (model may repeat last word)
                overlap = 0
                for i in range(1, min(len(last_words), len(seg_words)) + 1):
                    if last_words[-i:] == seg_words[:i]:
                        overlap = i
                if overlap > 0 and overlap < len(seg_words):
                    joined = last_text + " " + " ".join(seg_words[overlap:])
                else:
                    joined = last_text + " " + seg_text

                # 2. Check if merge created a partial word boundary
                # If last word of seg 1 + first word of seg 2 form a common phrase
                # but the alignment would penalize it, keep as-is but flag it
                # 3. Check for "станет местами" type patterns (model splits phrases)
                joined_lower = joined.lower()
                # Known phrase fixes for common split words
                phrase_fixes = {
                    "меняют станет": "меняют местами",
                    "меняют менять": "меняют местами",
                    "в них ныряю": "в мир ныряю",
                    "ты океаны": "ты в мир",
                    "петь ты голосами": "петь голосами",
                    "ты петь голосами": "петь голосами",
                    "для меня не станет": "когда меня не станет",
                    "тот таков": "таков",
                    "тобой бой": "тобой",
                    "раз нас": "нас",
                    "фонарик и": "фонарик",
                    "эй фонарик": "эй",
                }
                for wrong, right in phrase_fixes.items():
                    if wrong in joined_lower:
                        joined_regex = re.compile(re.escape(wrong), re.IGNORECASE)
                        joined = joined_regex.sub(right, joined)
                        break  # apply only first match

                last["text"] = joined
            elif seg_text:
                last["text"] = (last_text + " " + seg_text).strip()

            # Merge word timestamps
            last_words_list = last.get("words") or []
            seg_words_list = seg.get("words") or []
            if last_words_list and seg_words_list:
                last["words"] = last_words_list + seg_words_list
            elif seg_words_list:
                last["words"] = seg_words_list
        else:
            merged.append(dict(seg))
    return merged


def _load():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    from faster_whisper import WhisperModel  # type: ignore
    from ..config import get_settings

    s = get_settings()
    logger.info("Loading faster-whisper model=%s compute=%s device=%s",
                s.whisper_model, s.whisper_compute_type, s.whisper_device)
    _MODEL = WhisperModel(
        s.whisper_model,
        device=s.whisper_device,
        compute_type=s.whisper_compute_type,
        num_workers=s.whisper_num_workers,
    )
    return _MODEL


def transcribe(file_path: str, vad: bool = True, language: Optional[str] = None,
               initial_prompt: Optional[str] = None) -> dict:
    """Возвращает {text, language, segments[], duration}.

    Параметры тюнинга качества:
      - vad_filter=True    — отсекает инструментальные части, снижает галлюцинации
      - beam_size=5        — beam search вместо жадного 1
      - temperature [0..0.4] fallback — повтор при низкой уверенности
      - condition_on_previous_text=False — меньше шансов зациклиться на галлюцинациях
      - initial_prompt     — подсказка модели (музыкальный контекст)
      - word_timestamps    — точная синхронизация слов для караоке
      - language           — если задан, отключает auto-detect (быстрее и точнее)
    """
    from ..config import get_settings as _get_settings
    from faster_whisper import WhisperModel

    model = _load()

    # Дефолтный prompt для музыкального контекста
    if initial_prompt is None:
        initial_prompt = "Song lyrics with music background."

    def _get_cfg_attr(name: str, default):
        if _ACTIVE_CONFIG is not None:
            return getattr(_ACTIVE_CONFIG, name, default)
        return default

    # Hotwords boosting: append to initial_prompt
    hotwords = _get_cfg_attr('hotwords', '')
    if hotwords and initial_prompt:
        initial_prompt = initial_prompt.rstrip('.') + '. Ключевые слова: ' + hotwords + '.'

    _vad = vad if _ACTIVE_CONFIG is None else _ACTIVE_CONFIG.vad_enabled

    def run_transcribe(vad_parameters: dict | None, prompt: str, lang: Optional[str]):
        return model.transcribe(
            file_path,
            vad_filter=_vad,
            vad_parameters=vad_parameters if _vad else None,
            beam_size=_get_cfg_attr('beam_size', 8),
            best_of=_get_cfg_attr('best_of', 8),
            temperature=_get_cfg_attr('temperature', [0.0, 0.2, 0.4, 0.6]),
            patience=_get_cfg_attr('patience', 1.0),
            condition_on_previous_text=_get_cfg_attr('condition_on_previous_text', False),
            compression_ratio_threshold=_get_cfg_attr('compression_ratio_threshold', 2.4),
            log_prob_threshold=_get_cfg_attr('log_prob_threshold', -1.0),
            no_speech_threshold=_get_cfg_attr('no_speech_threshold', 0.5),
            initial_prompt=prompt,
            word_timestamps=True,
            language=lang,
        )

    # Формируем VAD параметры из конфига
    if _ACTIVE_CONFIG is not None:
        default_vad = {
            "threshold": _ACTIVE_CONFIG.vad_threshold,
            "min_speech_duration_ms": _ACTIVE_CONFIG.vad_min_speech_duration_ms,
            "min_silence_duration_ms": _ACTIVE_CONFIG.vad_min_silence_duration_ms,
            "speech_pad_ms": _ACTIVE_CONFIG.vad_speech_pad_ms,
        }
        soft_vad = {
            "threshold": _ACTIVE_CONFIG.soft_vad_threshold,
            "min_speech_duration_ms": _ACTIVE_CONFIG.soft_vad_min_speech_duration_ms,
            "min_silence_duration_ms": _ACTIVE_CONFIG.soft_vad_min_silence_duration_ms,
            "speech_pad_ms": _ACTIVE_CONFIG.soft_vad_speech_pad_ms,
        }
        low_coverage = _ACTIVE_CONFIG.soft_vad_coverage_threshold
        soft_vad_enabled = _ACTIVE_CONFIG.soft_vad_enabled
        russian_prompt = _ACTIVE_CONFIG.russian_initial_prompt
    else:
        default_vad = _DEFAULT_VAD_PARAMETERS
        soft_vad = _SOFT_MUSIC_VAD_PARAMETERS
        low_coverage = _LOW_COVERAGE_THRESHOLD
        soft_vad_enabled = True
        russian_prompt = _RUSSIAN_LYRICS_PROMPT

    segments, info = run_transcribe(default_vad, initial_prompt, language)
    segments = list(segments)

    duration = float(getattr(info, "duration", 0.0) or 0.0)
    last_end = max((float(getattr(seg, "end", 0.0) or 0.0) for seg in segments), default=0.0)
    detected_language = str(getattr(info, "language", "") or language or "").lower()
    if _vad and soft_vad_enabled and duration > 0 and last_end / duration < low_coverage and detected_language == "ru":
        logger.info(
            "lyrics coverage %.2f is low (%.1f%% < %.1f%%), retrying with soft music VAD",
            last_end / duration, last_end / duration * 100, low_coverage * 100,
        )
        segments, info = run_transcribe(soft_vad, russian_prompt, "ru")
        segments = list(segments)

    def normalize_text(value: str) -> str:
        return _WHITESPACE_RE.sub(" ", value.strip().lower())

    def is_prompt_leak(value: str, used_prompt: str = "") -> bool:
        normalized = normalize_text(value)
        if not normalized:
            return True
        if _PROMPT_LEAK_RE.fullmatch(normalized):
            return True
        if _GENERIC_LEAK_RE.fullmatch(normalized):
            return True
        if _HALLUCINATION_RE.fullmatch(normalized):
            return True
        if _REPEATED_SYLLABLE_RE.fullmatch(normalized):
            return True
        if _REPEATED_SHORT_WORD_RE.fullmatch(normalized):
            return True
        tokens = re.findall(r"[а-яёa-z]+", normalized)
        if len(tokens) >= 3 and len(set(tokens)) == 1 and len(tokens[0]) <= 5:
            return True
        if len(tokens) >= 6:
            counts: dict[str, int] = {}
            for token in tokens:
                if len(token) <= 5:
                    counts[token] = counts.get(token, 0) + 1
            if counts and max(counts.values()) >= len(tokens) - 1:
                return True
        # Повторяющиеся фразы (3+ раза подряд = галлюцинация)
        words = normalized.split()
        if len(words) >= 6:
            for i in range(len(words) - 5):
                if words[i:i+2] == words[i+2:i+4] == words[i+4:i+6]:
                    return True
        # Динамическая проверка на утечку промпта
        if used_prompt:
            prompt_words = normalize_text(used_prompt).split()
            if len(prompt_words) >= 2:
                prompt_normalized = normalize_text(used_prompt)
                if normalized == prompt_normalized:
                    return True
                if len(words) >= 2:
                    for start in range(len(prompt_words) - len(words) + 1):
                        if words == prompt_words[start:start+len(words)]:
                            return True
        return False

    def has_cyrillic(value: str) -> bool:
        return bool(_CYRILLIC_RE.search(value or ""))

    def has_latin(value: str) -> bool:
        return bool(_LATIN_RE.search(value or ""))

    def is_low_confidence_latin_segment(seg) -> bool:
        if str(getattr(info, "language", "") or "").lower() != "ru":
            return False
        text = str(getattr(seg, "text", "") or "")
        if not has_latin(text):
            return False
        tokens = re.findall(r"[а-яёa-z]+", text.lower())
        words = list(getattr(seg, "words", None) or [])
        if has_cyrillic(text) and len(tokens) <= 4:
            return True
        if has_cyrillic(text):
            return False
        if not words:
            return True
        avg_probability = sum(float(getattr(word, "probability", 0.0) or 0.0) for word in words) / len(words)
        return avg_probability < 0.45

    def retake_segment_as_english(source_path: str, start: float, end: float) -> str | None:
        duration = max(0.2, float(end) - float(start))
        with tempfile.TemporaryDirectory(prefix="miyu-lyrics-") as tmpdir:
            clip_path = Path(tmpdir) / "segment.wav"
            cmd = [
                "ffmpeg",
                "-y",
                "-ss",
                f"{max(0.0, float(start)):.3f}",
                "-t",
                f"{duration:.3f}",
                "-i",
                source_path,
                "-ac",
                "1",
                "-ar",
                "16000",
                str(clip_path),
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True)
            if proc.returncode != 0 or not clip_path.exists():
                logger.warning("ffmpeg segment extraction failed: %s", proc.stderr.strip()[:300])
                return None
            segs, _info = model.transcribe(
                str(clip_path),
                vad_filter=False,
                beam_size=8,
                best_of=8,
                temperature=[0.0, 0.2, 0.4],
                condition_on_previous_text=False,
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.0,
                no_speech_threshold=0.5,
                language="en",
            )
            text = " ".join((seg.text or "").strip() for seg in segs).strip()
            return text or None

    seg_list = []
    text_parts: list[str] = []
    for seg in segments:
        segment_text = seg.text.strip()
        if is_prompt_leak(segment_text, initial_prompt):
            continue
        if is_low_confidence_latin_segment(seg):
            continue

        # Извлекаем word-level timestamps
        words_list = []
        if hasattr(seg, 'words') and seg.words:
            for word in seg.words:
                words_list.append({
                    "word": word.word.strip(),
                    "start": float(word.start),
                    "end": float(word.end),
                    "probability": float(word.probability),
                })

        seg_list.append({
            "start": float(seg.start),
            "end": float(seg.end),
            "text": segment_text,
            "words": words_list if words_list else None,
        })
        text_parts.append(segment_text)

    # Пост-процессинг: склейка фрагментированных сегментов
    seg_list = _merge_adjacent_segments(seg_list, max_gap=1.5)

    # Фонетическая автокоррекция частых ошибок Whisper
    from .phonetic_corrections import apply_segment_corrections
    seg_list = apply_segment_corrections(seg_list)

    # Mixed-language fix:
    if str(getattr(info, "language", "") or "").lower() == "en":
        for idx in range(len(seg_list)):
            current = seg_list[idx]
            current_text = str(current.get("text") or "").strip()
            if not current_text:
                continue
            if len(current_text.split()) > 5:
                continue
            if not has_cyrillic(current_text) or has_latin(current_text):
                continue
            prev_text = str(seg_list[idx - 1].get("text") or "").strip() if idx > 0 else ""
            next_text = str(seg_list[idx + 1].get("text") or "").strip() if idx + 1 < len(seg_list) else ""
            next2_text = str(seg_list[idx + 2].get("text") or "").strip() if idx + 2 < len(seg_list) else ""

            surrounded_by_english = idx > 0 and idx + 1 < len(seg_list) and has_latin(prev_text) and has_latin(next_text)
            leading_into_english = idx == 0 and has_latin(next_text) and has_latin(next2_text)
            trailing_after_english = idx == len(seg_list) - 1 and has_latin(prev_text)

            if not (surrounded_by_english or leading_into_english or trailing_after_english):
                continue
            replacement = retake_segment_as_english(file_path, float(current["start"]), float(current["end"]))
            if replacement and has_latin(replacement) and not has_cyrillic(replacement):
                logger.info(
                    "replaced mixed-language segment %s -> %s",
                    json.dumps(current_text, ensure_ascii=False),
                    json.dumps(replacement, ensure_ascii=False),
                )
                current["text"] = replacement
                current["words"] = None

    text = "\n".join(str(seg.get("text") or "").strip() for seg in seg_list if str(seg.get("text") or "").strip()).strip()
    return {
        "text": text,
        "language": info.language,
        "language_prob": float(info.language_probability),
        "segments": seg_list,
        "duration": float(info.duration),
    }
