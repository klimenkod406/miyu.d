from __future__ import annotations

import re
from typing import Any

from ..config import get_settings
from .aggregator import RED_FLAGS
from .text_moderation import analyze_explicit

_FRAGMENT_LIMIT = 5
_CONTEXT_CHARS = 48
_SEVERITY_ORDER = {"red": 0, "warning": 1, "info": 2}
_TYPE_ORDER = {
    "invalid_audio": 0,
    "nsfw_cover": 1,
    "lyrics_explicit": 2,
    "drug_reference": 3,
    "toxicity": 4,
    "duplicate": 5,
    "audio_quality": 6,
    "general_flag": 7,
}

_FLAG_META = {
    "invalid_audio": (
        "invalid_audio",
        "red",
        "Некорректный аудиофайл",
        "Аудиофайл не прошёл pre-flight проверку: длительность или формат выглядят некорректно.",
    ),
    "possible_duplicate": (
        "duplicate",
        "red",
        "Возможный дубликат",
        "AI нашёл высокий риск совпадения с уже загруженным треком.",
    ),
    "nsfw_cover": (
        "nsfw_cover",
        "red",
        "NSFW-обложка",
        "Обложка получила высокий NSFW-риск.",
    ),
    "suggestive_cover": (
        "nsfw_cover",
        "warning",
        "Сомнительная обложка",
        "Обложка получила пограничный suggestive-риск.",
    ),
    "toxic": (
        "toxicity",
        "warning",
        "Токсичность",
        "Текст получил повышенный toxicity-риск.",
    ),
    "hate": (
        "toxicity",
        "red",
        "Hate-речь",
        "Текст получил высокий hate/toxicity-риск.",
    ),
}

_CATEGORY_META = {
    "severe": (
        "lyrics_explicit",
        "warning",
        "Нецензурный текст",
        "В тексте найдены грубые explicit-слова.",
    ),
    "moderate": (
        "lyrics_explicit",
        "warning",
        "Нецензурный текст",
        "В тексте найдены explicit-слова средней тяжести.",
    ),
    "mild": (
        "lyrics_explicit",
        "info",
        "Мягкая нецензурная лексика",
        "В тексте найдены мягкие explicit-слова.",
    ),
    "slur": (
        "lyrics_explicit",
        "red",
        "Оскорбления / slur",
        "В тексте найдены оскорбительные slur-выражения.",
    ),
    "drug": (
        "drug_reference",
        "warning",
        "Упоминание наркотиков",
        "В тексте найдено упоминание наркотиков в контексте употребления или распространения.",
    ),
}


def _text_window(text: str, start: int, end: int) -> dict[str, str]:
    before = text[max(0, start - _CONTEXT_CHARS):start].strip()
    after = text[end:min(len(text), end + _CONTEXT_CHARS)].strip()
    return {"context_before": before, "context_after": after}


def _find_segment(segments: list[dict[str, Any]], matched_word: str) -> dict[str, Any] | None:
    needle = matched_word.lower().replace("ё", "е")
    for segment in segments:
        text = str(segment.get("text") or "").lower().replace("ё", "е")
        if needle and needle in text:
            return segment
    return None


def _fragment(text: str, match: dict[str, Any], segments: list[dict[str, Any]]) -> dict[str, Any]:
    start = int(match.get("start") or 0)
    end = int(match.get("end") or start)
    word = str(match.get("word") or text[start:end])
    window = _text_window(text, start, end)
    fragment_text = f"{window['context_before']} {word} {window['context_after']}".strip()
    out: dict[str, Any] = {
        "text": re.sub(r"\s+", " ", fragment_text),
        "matched_words": [word],
        **window,
    }
    segment = _find_segment(segments, word)
    if segment is not None:
        out["start"] = float(segment.get("start") or 0.0)
        out["end"] = float(segment.get("end") or out["start"])
    return out


def _merge_severity(left: str, right: str) -> str:
    return left if _SEVERITY_ORDER[left] <= _SEVERITY_ORDER[right] else right


def _text_evidence(lyrics_text: str, segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not lyrics_text.strip():
        return []
    analysis = analyze_explicit(lyrics_text)
    grouped: dict[str, dict[str, Any]] = {}
    for match in analysis.matches:
        category = str(match.get("category") or "")
        if category not in _CATEGORY_META:
            continue
        item_type, severity, title, explanation = _CATEGORY_META[category]
        key = item_type if item_type == "drug_reference" else "lyrics_explicit"
        item = grouped.setdefault(key, {
            "type": item_type,
            "severity": severity,
            "title": title,
            "explanation": explanation,
            "score": analysis.score if item_type == "lyrics_explicit" else None,
            "count": 0,
            "fragments": [],
        })
        item["severity"] = _merge_severity(item["severity"], severity)
        if severity == "red":
            item["title"] = title
            item["explanation"] = explanation
        item["count"] += 1
        if len(item["fragments"]) < _FRAGMENT_LIMIT:
            item["fragments"].append(_fragment(lyrics_text, match, segments))
    return list(grouped.values())


def _flag_evidence(flags: list[str], ai_score: float | None) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    text_handled = {"explicit_lyrics", "explicit_heavy", "drug_reference", "hate_slur"}
    for flag in flags:
        if flag in text_handled:
            continue
        item_type, severity, title, explanation = _FLAG_META.get(
            flag,
            ("general_flag", "warning" if flag in RED_FLAGS else "info", flag, f"AI flag: {flag}"),
        )
        item: dict[str, Any] = {
            "type": item_type,
            "severity": severity,
            "title": title,
            "explanation": explanation,
        }
        if ai_score is not None:
            item["score"] = float(ai_score)
        items.append(item)
    return items


def _sort_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(items, key=lambda item: (_SEVERITY_ORDER[item["severity"]], _TYPE_ORDER.get(item["type"], 99)))


def build_moderation_evidence(payload: dict[str, Any]) -> dict[str, Any]:
    track_id = int(payload.get("track_id") or 0)
    ai_score = payload.get("ai_score")
    score = float(ai_score) if ai_score is not None else None
    flags = list(payload.get("ai_flags") or [])
    lyrics_text = str(payload.get("lyrics_text") or "")
    segments = list(payload.get("segments") or [])

    evidence = _sort_items(_text_evidence(lyrics_text, segments) + _flag_evidence(flags, score))
    red_count = sum(1 for item in evidence if item["severity"] == "red")
    warning_count = sum(1 for item in evidence if item["severity"] == "warning")
    info_count = sum(1 for item in evidence if item["severity"] == "info")

    if red_count > 0 or (score is not None and score >= get_settings().flag_threshold):
        decision = "flag"
    elif warning_count > 0:
        decision = "pending"
    elif score is None:
        decision = "unknown"
    else:
        decision = "approve"

    return {
        "track_id": track_id,
        "summary": {
            "decision": decision,
            "score": score,
            "reasons": [item["title"] for item in evidence],
            "red_count": red_count,
            "warning_count": warning_count,
            "info_count": info_count,
        },
        "evidence": evidence,
    }
