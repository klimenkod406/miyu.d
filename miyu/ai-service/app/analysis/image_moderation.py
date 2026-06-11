"""NSFW-классификатор для обложек на opennsfw2."""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

_THRESHOLD = 0.6


def nsfw_score(image_path: str) -> float:
    """Вероятность NSFW (0..1). При ошибке возвращает 0.0."""
    try:
        import opennsfw2 as n2  # type: ignore
        score = n2.predict_image(image_path)
        return float(score)
    except Exception as e:
        logger.warning("NSFW classifier failed: %s", e)
        return 0.0


def is_nsfw(image_path: str, threshold: float = _THRESHOLD) -> bool:
    return nsfw_score(image_path) >= threshold
