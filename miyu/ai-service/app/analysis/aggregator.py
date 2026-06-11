"""Агрегатор сигналов модерации → ai_score, ai_flags, decision.

Сигналы:
  - text_moderation: mmr_score, is_18plus, has_red_flag, categories
  - nsfw_cover: вероятность 0..1
  - invalid_audio, possible_duplicate
  - artist_is_verified

Решение:
  - is_18plus → всегда 'flag' (на модерацию админу)
  - mmr_score < auto_approve_threshold AND no red-flags → 'approve'
  - mmr_score >= flag_threshold OR has_red_flag → 'flag'
  - иначе → 'pending'
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..config import get_settings
from .. import metrics as m

RED_FLAGS = {"hate", "nsfw_cover", "invalid_audio", "hate_slur", "possible_duplicate"}


@dataclass
class ModerationSignals:
    # Text moderation (from text_moderation.analyze)
    is_18plus: bool = False
    mmr_score: float = 0.0           # 0..1
    density: float = 0.0
    total_hits: int = 0
    categories: dict = field(default_factory=dict)  # {category: count}
    has_red_flag: bool = False       # racism/fascism

    # Image
    nsfw_cover: float = 0.0

    # Audio
    invalid_audio: bool = False

    # Duplicate
    possible_duplicate: bool = False
    duplicate_score: float = 0.0

    # Artist
    artist_is_verified: bool = True

    extra: dict = field(default_factory=dict)


@dataclass
class ModerationDecision:
    ai_score: float      # mmr_score
    ai_flags: list[str]
    decision: str        # 'approve' | 'pending' | 'flag'


def _categories_to_flags(categories: dict, mmr: float) -> list[str]:
    """Конвертирует категории в human-readable флаги."""
    flags = []
    cat_map = {
        "profanity": "profanity",
        "sex": "sexual_content",
        "drugs": "drug_reference",
        "smoking": "smoking",
        "alcohol": "alcohol",
        "racism": "hate_slur",
        "nationalism": "nationalism",
        "fascism": "hate_slur",
        "violence": "violence",
    }
    for cat, flag in cat_map.items():
        if cat in categories:
            if flag not in flags:
                flags.append(flag)

    if mmr >= 0.5:
        if "profanity" in flags:
            flags.append("explicit_heavy")
        else:
            flags.append("explicit_lyrics")
    elif mmr >= 0.15:
        flags.append("explicit_lyrics")

    return flags


def aggregate(s: ModerationSignals) -> ModerationDecision:
    cfg = get_settings()
    flags: list[str] = []

    # === Text moderation ===
    if s.mmr_score > 0:
        flags.extend(_categories_to_flags(s.categories, s.mmr_score))

    score = s.mmr_score

    # Red flag override: racism/fascism
    if s.has_red_flag:
        score = max(score, 0.85)
        if "hate_slur" not in flags:
            flags.append("hate_slur")

    # === NSFW cover ===
    if s.nsfw_cover >= 0.6:
        flags.append("nsfw_cover")
        score = max(score, 0.85)
    elif s.nsfw_cover >= 0.3:
        flags.append("suggestive_cover")
        score = max(score, 0.4)

    # === Audio issues ===
    if s.invalid_audio:
        flags.append("invalid_audio")
        score = max(score, 0.9)

    # === Duplicates ===
    if s.possible_duplicate:
        flags.append("possible_duplicate")
        score = max(score, max(0.5, s.duplicate_score))

    # === Unverified artist penalty ===
    if not s.artist_is_verified:
        score = min(1.0, score + cfg.unverified_artist_penalty)

    score = round(min(1.0, max(0.0, score)), 4)
    has_red_flag = any(f in RED_FLAGS for f in flags)

    # === Decision ===
    if s.is_18plus:
        decision = "flag"    # любой триггер → на модерацию
    elif has_red_flag or score >= cfg.flag_threshold:
        decision = "flag"
    elif score < cfg.auto_approve_threshold:
        decision = "approve"
    else:
        decision = "pending"

    # Metrics
    m.moderation_ai_score.observe(score)
    m.moderation_decisions_total.labels(decision=decision).inc()
    for flag in flags:
        m.moderation_flags_total.labels(flag=flag).inc()

    return ModerationDecision(
        ai_score=score,
        ai_flags=list(dict.fromkeys(flags)),  # dedup preserving order
        decision=decision,
    )
