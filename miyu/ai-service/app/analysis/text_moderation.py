"""Текстовая модерация: 9 категорий + MMR скоринг.

Категории: sex, drugs, smoking, alcohol, racism, nationalism, fascism,
           violence, profanity.

Любой триггер → 18+ (is_18plus = True).
Для MMR (auto-approve) используется взвешенная плотность.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

from .profanity_dict import check_all

logger = logging.getLogger(__name__)

# Пороги для MMR
_MMR_DENSITY_FACTOR = 3.0  # 33% триггерных слов → mmr = 1.0
_MMR_MIN_PROFANITY = 0.15   # хотя бы 1 мат → mmr >= 0.15
_MMR_MIN_RED_FLAG = 0.85    # racism/fascism → mmr >= 0.85
_MMR_MIN_SEX = 0.5          # секс → mmr >= 0.5
_MMR_MIN_DRUGS = 0.4        # наркотики → mmr >= 0.4
_MMR_MIN_VIOLENCE = 0.3     # насилие → mmr >= 0.3


@dataclass
class ModerationResult:
    """Результат полной модерации текста."""
    is_18plus: bool = False
    mmr_score: float = 0.0          # 0..1 — итоговый MMR
    density: float = 0.0            # доля триггеров в тексте
    total_hits: int = 0
    word_count: int = 0
    categories: dict = field(default_factory=dict)  # {category: count}
    has_red_flag: bool = False
    hits: dict = field(default_factory=dict)        # {category: [matches]}

    def to_dict(self) -> dict:
        return {
            "is_18plus": self.is_18plus,
            "mmr_score": self.mmr_score,
            "density": self.density,
            "total_hits": self.total_hits,
            "word_count": self.word_count,
            "categories": self.categories,
            "has_red_flag": self.has_red_flag,
            "hits": {k: len(v) for k, v in self.hits.items()},
        }


def analyze(text: str | None) -> ModerationResult:
    """Полная модерация текста: 9 категорий + MMR.

    Правила MMR:
      1. Любой хит → is_18plus = True
      2. base = min(1.0, total_weighted / word_count * _MMR_DENSITY_FACTOR)
      3. profanity → mmr = max(mmr, 0.15)
      4. racism/fascism → mmr = max(mmr, 0.85)
      5. sex → mmr = max(mmr, 0.5)
      6. drugs → mmr = max(mmr, 0.4)
      7. violence → mmr = max(mmr, 0.3)
    """
    result = ModerationResult()

    if not text or not text.strip():
        return result

    raw = check_all(text)
    result.is_18plus = raw["is_18plus"]
    result.total_hits = raw["total_hits"]
    result.word_count = raw["word_count"]
    result.density = raw["density"]
    result.categories = raw["categories"]
    result.hits = raw["hits"]
    result.has_red_flag = raw["has_red_flag"]

    if not result.is_18plus:
        return result

    # MMR: взвешенная плотность
    mmr = min(1.0, raw["total_weighted"] / result.word_count * _MMR_DENSITY_FACTOR)

    # Минимальные пороги по категориям
    if raw["categories"].get("profanity", 0) > 0:
        mmr = max(mmr, _MMR_MIN_PROFANITY)  # хотя бы 0.15
    if raw["categories"].get("racism", 0) > 0 or raw["categories"].get("fascism", 0) > 0:
        mmr = max(mmr, _MMR_MIN_RED_FLAG)   # 0.85
    if raw["categories"].get("sex", 0) > 0:
        mmr = max(mmr, _MMR_MIN_SEX)        # 0.5
    if raw["categories"].get("drugs", 0) > 0:
        mmr = max(mmr, _MMR_MIN_DRUGS)      # 0.4
    if raw["categories"].get("violence", 0) > 0:
        mmr = max(mmr, _MMR_MIN_VIOLENCE)   # 0.3

    result.mmr_score = round(min(1.0, mmr), 4)
    return result


# ============================================================
# Text embedding (оставляем, не зависит от Detoxify)
# ============================================================
_EMB_MODEL = None


def _load_embedder():
    global _EMB_MODEL
    if _EMB_MODEL is not None:
        return _EMB_MODEL
    from sentence_transformers import SentenceTransformer  # type: ignore
    from ..config import get_settings
    logger.info("Loading text embedder (%s)...", get_settings().text_embedding_model)
    _EMB_MODEL = SentenceTransformer(get_settings().text_embedding_model)
    return _EMB_MODEL


def embed(text: str) -> Optional[np.ndarray]:
    """Text embedding через sentence-transformers."""
    if not text or not text.strip():
        return None
    from ..config import get_settings
    if not get_settings().enable_text_embeddings:
        logger.info("Text embeddings disabled by config")
        return None
    try:
        model = _load_embedder()
        vec = model.encode(f"passage: {text}", normalize_embeddings=True)
        return np.asarray(vec, dtype=np.float32)
    except Exception as e:
        logger.exception("Text embedding failed: %s", e)
        return None


# ============================================================
# Backward-compatible API
# ============================================================

@dataclass
class ExplicitAnalysis:
    """Backward-compatible: обёртка над ModerationResult для старого кода."""
    score: float = 0.0
    density: float = 0.0
    total_words: int = 0
    total_count: int = 0
    # is_explicit computed via @property
    severe_count: int = 0
    moderate_count: int = 0
    mild_count: int = 0
    slur_count: int = 0
    drug_count: int = 0
    has_slur: bool = False
    has_drug_reference: bool = False
    matches: list = field(default_factory=list)

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


def analyze_explicit(text: str) -> ExplicitAnalysis:
    """Backward-compatible: обёртка."""
    result = analyze(text)
    ea = ExplicitAnalysis(
        score=result.mmr_score,
        density=result.density,
        total_words=result.word_count,
        total_count=result.total_hits,
        # is_explicit=result.is_18plus,  # computed via @property
        severe_count=result.total_hits,
        has_slur=result.has_red_flag,
        matches=[],
    )
    # Map new categories to old fields
    for cat, count in result.categories.items():
        if cat in ("racism", "fascism"):
            ea.slur_count += count
        elif cat == "drugs":
            ea.drug_count += count
            ea.has_drug_reference = True

    # Flatten hits to matches
    for cat, cat_hits in result.hits.items():
        for m in cat_hits:
            ea.matches.append(m)

    return ea


def is_explicit(text: str) -> bool:
    """Backward-compatible."""
    return analyze(text).is_18plus


def mark_explicit_words(text: str) -> list[dict]:
    """Backward-compatible."""
    result = analyze(text)
    matches = []
    for cat_hits in result.hits.values():
        matches.extend(cat_hits)
    return matches
