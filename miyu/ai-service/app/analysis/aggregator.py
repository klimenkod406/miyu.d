"""Агрегатор сигналов модерации → ai_score, ai_flags, decision.

Решение:
  - score < auto_approve_threshold AND no red-flags → 'approve'
  - score >= flag_threshold OR any red-flag → 'flag'
  - иначе → 'pending'
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from ..config import get_settings
from .. import metrics as m

RED_FLAGS = {"hate", "nsfw_cover", "invalid_audio", "possible_duplicate", "hate_slur"}


@dataclass
class ModerationSignals:
    toxicity: dict | None = None       # {toxicity, severe_toxicity, identity_attack, ...}
    is_explicit: bool = False
    explicit_score: float = 0.0        # 0..1 — детальный explicit-скор
    explicit_density: float = 0.0      # доля матов в тексте
    explicit_severe_count: int = 0
    explicit_moderate_count: int = 0
    explicit_mild_count: int = 0
    explicit_drug_count: int = 0       # упоминания наркотиков
    explicit_has_slur: bool = False    # red-flag (расовые/гомофобные оскорбления)
    explicit_has_drug: bool = False    # soft-flag (упоминание наркотиков)
    nsfw_cover: float = 0.0            # вероятность 0..1
    invalid_audio: bool = False
    possible_duplicate: bool = False
    duplicate_score: float = 0.0
    artist_is_verified: bool = True

    extra: dict = field(default_factory=dict)


@dataclass
class ModerationDecision:
    ai_score: float
    ai_flags: list[str]
    decision: str   # 'approve' | 'pending' | 'flag'


def aggregate(s: ModerationSignals) -> ModerationDecision:
    cfg = get_settings()
    flags: list[str] = []
    score = 0.0

    # Toxicity (Detoxify)
    if s.toxicity:
        tox = float(s.toxicity.get("toxicity", 0.0))
        sev = float(s.toxicity.get("severe_toxicity", 0.0))
        ident = float(s.toxicity.get("identity_attack", 0.0))
        threat = float(s.toxicity.get("threat", 0.0))
        # Композиция: max от нескольких категорий
        tox_max = max(tox, sev, ident, threat)
        score = max(score, tox_max)
        if tox_max >= 0.85 or ident >= 0.7 or threat >= 0.7:
            flags.append("hate")
        elif tox_max >= 0.5:
            flags.append("toxic")

    # Explicit-лексика: используем детальный score (0..1) вместо бинарного флага
    if s.explicit_has_slur:
        # Расовые/гомофобные оскорбления — red-flag
        flags.append("hate_slur")
        score = max(score, 0.85)
    if s.explicit_score >= 0.5:
        flags.append("explicit_heavy")
        score = max(score, s.explicit_score)
    elif s.explicit_score >= 0.15 or s.is_explicit:
        flags.append("explicit_lyrics")
        score = max(score, s.explicit_score if s.explicit_score > 0 else 0.15)

    # Drug references: soft-flag, добавляет к score
    if s.explicit_has_drug:
        flags.append("drug_reference")
        # Чем больше упоминаний — тем выше вклад (но не red-flag сам по себе)
        drug_score = min(0.6, 0.2 + 0.1 * s.explicit_drug_count)
        score = max(score, drug_score)

    if s.nsfw_cover >= 0.6:
        flags.append("nsfw_cover")
        score = max(score, 0.85)
    elif s.nsfw_cover >= 0.3:
        flags.append("suggestive_cover")
        score = max(score, 0.4)

    if s.invalid_audio:
        flags.append("invalid_audio")
        score = max(score, 0.9)

    if s.possible_duplicate:
        flags.append("possible_duplicate")
        score = max(score, max(0.5, s.duplicate_score))

    if not s.artist_is_verified:
        score = min(1.0, score + cfg.unverified_artist_penalty)

    score = round(min(1.0, max(0.0, score)), 4)
    has_red_flag = any(f in RED_FLAGS for f in flags)

    if has_red_flag or score >= cfg.flag_threshold:
        decision = "flag"
    elif score < cfg.auto_approve_threshold:
        decision = "approve"
    else:
        decision = "pending"

    # Metrics (Phase 5)
    m.moderation_ai_score.observe(score)
    m.moderation_decisions_total.labels(decision=decision).inc()
    for flag in flags:
        m.moderation_flags_total.labels(flag=flag).inc()

    return ModerationDecision(ai_score=score, ai_flags=flags, decision=decision)
