"""Текстовая модерация: toxicity (Detoxify) + категоризация explicit + эмбеддинг.

Архитектура explicit-анализа:
  - 4 категории: severe / moderate / mild / slur (см. profanity_dict.py)
  - whitelist для устранения false positives
  - explicit_score (0..1) учитывает severity + плотность матов
  - explicit_density = explicit_count / total_words
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

from .profanity_dict import (
    SEVERE_PATTERNS,
    MODERATE_PATTERNS,
    MILD_PATTERNS,
    SLUR_PATTERNS,
    DRUG_PATTERNS,
    WHITELIST,
)

logger = logging.getLogger(__name__)

# Веса категорий для explicit_score
CATEGORY_WEIGHTS = {
    "severe": 1.0,
    "moderate": 0.6,
    "mild": 0.3,
    "slur": 1.0,
    "drug": 0.7,
}

# Скомпилированные regex по категориям
_SEVERE_RE = re.compile("|".join(SEVERE_PATTERNS), re.IGNORECASE)
_MODERATE_RE = re.compile("|".join(MODERATE_PATTERNS), re.IGNORECASE)
_MILD_RE = re.compile("|".join(MILD_PATTERNS), re.IGNORECASE)
_SLUR_RE = re.compile("|".join(SLUR_PATTERNS), re.IGNORECASE)
_DRUG_RE = re.compile("|".join(DRUG_PATTERNS), re.IGNORECASE)

# Объединённый regex для быстрой проверки и подсветки
_ALL_RE = re.compile(
    "|".join(SEVERE_PATTERNS + MODERATE_PATTERNS + MILD_PATTERNS + SLUR_PATTERNS + DRUG_PATTERNS),
    re.IGNORECASE,
)

_WORD_RE = re.compile(r"[\w']+", re.UNICODE)
_OBFUSCATION_RE = re.compile(r"(?<=[а-яёa-z0-9])[^а-яёa-z0-9\s]+(?=[а-яёa-z0-9])", re.IGNORECASE)
_REPEAT_RE = re.compile(r"([а-яёa-z])\1+", re.IGNORECASE)
_LATIN_TO_CYRILLIC = str.maketrans({"a":"а","e":"е","o":"о","p":"р","c":"с","x":"х","y":"у","A":"А","E":"Е","O":"О","P":"Р","C":"С","X":"Х","Y":"У","B":"В","H":"Н","K":"К","M":"М","T":"Т"})
_SEVERE_ROOT_HINT_RE = re.compile(r"(х[у]?й|ху[яеюи]|п[ие]зд|[её]б|бля|пид[ао]р|муд[аи]к)", re.IGNORECASE)
_CONTEXT_DRUG_TERMS = {"травка", "косяк", "план", "шишки", "бошки", "соль", "кислота", "клад", "приход", "спид", "кокс"}
_DRUG_CONTEXT_RE = re.compile(
    r"\b(кур\w*|дун\w*|нюх\w*|закин\w*|дилер\w*|барыг\w*|наркот\w*|меф\w*|кокаин\w*|героин\w*|амф\w*|мдма|лсд|weed|cocaine|heroin|meth|mdma|dealer|snort\w*)\b",
    re.IGNORECASE,
)


@dataclass
class ExplicitAnalysis:
    """Результат анализа нецензурной лексики."""
    score: float = 0.0                                # 0..1, итоговый explicit-скор
    density: float = 0.0                              # доля матов в тексте 0..1
    total_words: int = 0
    severe_count: int = 0
    moderate_count: int = 0
    mild_count: int = 0
    slur_count: int = 0
    drug_count: int = 0                               # упоминания наркотиков
    has_slur: bool = False                            # red-flag для агрегатора
    has_drug_reference: bool = False                  # soft-flag (≥1 упоминание)
    matches: list[dict] = field(default_factory=list) # [{start, end, word, category, severity}]

    @property
    def total_count(self) -> int:
        return (self.severe_count + self.moderate_count + self.mild_count
                + self.slur_count + self.drug_count)

    @property
    def is_explicit(self) -> bool:
        return self.total_count > 0

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "density": self.density,
            "total_words": self.total_words,
            "total_count": self.total_count,
            "severe_count": self.severe_count,
            "moderate_count": self.moderate_count,
            "mild_count": self.mild_count,
            "slur_count": self.slur_count,
            "drug_count": self.drug_count,
            "has_slur": self.has_slur,
            "has_drug_reference": self.has_drug_reference,
            "matches": self.matches,
        }


def _normalize_for_matching(value: str) -> str:
    normalized = (value or "").lower().replace("ё", "е")
    normalized = _OBFUSCATION_RE.sub("", normalized)
    return _REPEAT_RE.sub(r"\1\1", normalized)


def _has_drug_context(text: str, start: int, end: int) -> bool:
    window = text[max(0, start - 48):min(len(text), end + 48)].lower().replace("ё", "е")
    return bool(_DRUG_CONTEXT_RE.search(window))


def _categorize(word: str, *, full_text: str = "", start: int = 0, end: int | None = None) -> Optional[str]:
    """Определяет категорию слова или None если оно whitelisted/чистое."""
    wl = _normalize_for_matching(word)
    if wl in WHITELIST:
        return None
    if _SLUR_RE.fullmatch(wl) or _SLUR_RE.search(wl):
        # fullmatch предпочтительнее, но pattern содержит ^/$ редко — используем search с проверкой
        if _SLUR_RE.search(wl):
            return "slur"
    if _SEVERE_RE.search(wl) or _SEVERE_ROOT_HINT_RE.search(wl):
        return "severe"
    if _MODERATE_RE.search(wl):
        return "moderate"
    if _MILD_RE.search(wl):
        return "mild"
    if _DRUG_RE.search(wl):
        if wl in _CONTEXT_DRUG_TERMS and not _has_drug_context(full_text, start, end if end is not None else start + len(word)):
            return None
        return "drug"
    return None


def analyze_explicit(text: str) -> ExplicitAnalysis:
    """Категоризирует все нецензурные слова и считает скор.

    Скоринг:
      raw = sum(weight[cat] for cat in matched) / total_words
      score = min(1.0, raw * 4)   — масштабирование: 25% матов = 1.0
      slur_count > 0 → score >= 0.85 (red-flag)
    """
    result = ExplicitAnalysis()
    if not text or not text.strip():
        return result

    # Подсчёт слов в тексте
    words = _WORD_RE.findall(text)
    result.total_words = len(words)
    if result.total_words == 0:
        return result

    weighted_sum = 0.0
    normalized_text = _normalize_for_matching(text)
    seen_spans: set[tuple[int, int]] = set()

    def add_match(start: int, end: int, word: str, category: str) -> None:
        nonlocal weighted_sum
        if (start, end) in seen_spans:
            return
        seen_spans.add((start, end))
        weight = CATEGORY_WEIGHTS[category]
        weighted_sum += weight

        if category == "severe":
            result.severe_count += 1
        elif category == "moderate":
            result.moderate_count += 1
        elif category == "mild":
            result.mild_count += 1
        elif category == "slur":
            result.slur_count += 1
            result.has_slur = True
        elif category == "drug":
            result.drug_count += 1
            result.has_drug_reference = True

        result.matches.append({
            "start": start,
            "end": end,
            "word": word,
            "category": category,
            "severity": weight,
        })

    for m in _ALL_RE.finditer(normalized_text):
        word = m.group()
        if word.lower() in WHITELIST:
            continue
        category = _categorize(word, full_text=normalized_text, start=m.start(), end=m.end())
        if category is not None:
            add_match(m.start(), m.end(), word, category)

    for m in _WORD_RE.finditer(normalized_text):
        word = m.group()
        category = _categorize(word, full_text=normalized_text, start=m.start(), end=m.end())
        if category is not None:
            add_match(m.start(), m.end(), word, category)

    if result.total_count == 0:
        return result

    # Плотность: доля от общего числа слов
    result.density = round(result.total_count / result.total_words, 4)

    # Скор: взвешенная плотность * 4 (т.е. 25% severe-матов = 1.0)
    raw_score = weighted_sum / result.total_words
    score = min(1.0, raw_score * 4.0)

    # Минимум 0.15 если есть хоть один severe (чтобы 1 мат в 200-словесной песне дал ≥0.15)
    if result.severe_count > 0:
        score = max(score, 0.15)
    if result.moderate_count > 0 and score < 0.05:
        score = 0.05

    # Slur — всегда серьёзно
    if result.has_slur:
        score = max(score, 0.85)

    result.score = round(score, 4)
    return result


# ============================================================
# Backward-compatible API
# ============================================================

def is_explicit(text: str) -> bool:
    """Backward-compatible: True если найдено хотя бы одно матерное слово."""
    return analyze_explicit(text).is_explicit


def mark_explicit_words(text: str) -> list[dict]:
    """Backward-compatible: возвращает позиции слов для подсветки.

    Каждый элемент: {start, end, word, category, severity}
    """
    return analyze_explicit(text).matches

_TOXIC_MODEL = None
_EMB_MODEL = None


def _load_detoxify():
    global _TOXIC_MODEL
    if _TOXIC_MODEL is not None:
        return _TOXIC_MODEL
    from detoxify import Detoxify  # type: ignore
    from ..config import get_settings
    logger.info("Loading Detoxify (%s)...", get_settings().detoxify_model)
    _TOXIC_MODEL = Detoxify(get_settings().detoxify_model)
    return _TOXIC_MODEL


def _load_embedder():
    global _EMB_MODEL
    if _EMB_MODEL is not None:
        return _EMB_MODEL
    from sentence_transformers import SentenceTransformer  # type: ignore
    from ..config import get_settings
    logger.info("Loading text embedder (%s)...", get_settings().text_embedding_model)
    _EMB_MODEL = SentenceTransformer(get_settings().text_embedding_model)
    return _EMB_MODEL


def toxicity_scores(text: str) -> dict:
    """Возвращает словарь оценок Detoxify ({toxicity, severe_toxicity, obscene, ...})."""
    if not text or not text.strip():
        return {}
    from ..config import get_settings
    if not get_settings().enable_toxicity_model:
        logger.info("Detoxify toxicity model disabled by config")
        return {}
    try:
        model = _load_detoxify()
        result = model.predict(text)
        # Detoxify возвращает np.float32 — приведём к питон-флоту
        return {k: float(v) for k, v in result.items()}
    except Exception as e:
        logger.exception("Detoxify failed: %s", e)
        return {}


def embed(text: str) -> Optional[np.ndarray]:
    if not text or not text.strip():
        return None
    from ..config import get_settings
    if not get_settings().enable_text_embeddings:
        logger.info("Text embeddings disabled by config")
        return None
    try:
        model = _load_embedder()
        # e5 ожидает префикс "passage:" для документов
        vec = model.encode(f"passage: {text}", normalize_embeddings=True)
        return np.asarray(vec, dtype=np.float32)
    except Exception as e:
        logger.exception("Text embedding failed: %s", e)
        return None
