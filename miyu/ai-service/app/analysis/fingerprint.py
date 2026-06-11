"""Аудио-fingerprint через Chromaprint (нужна системная утилита `fpcalc`)."""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)


def compute(file_path: str) -> Optional[str]:
    """Возвращает компактный chromaprint-fingerprint или None при ошибке."""
    try:
        import acoustid  # type: ignore
        duration, fp = acoustid.fingerprint_file(file_path)
        if isinstance(fp, bytes):
            fp = fp.decode("ascii", errors="ignore")
        return fp
    except Exception as e:
        logger.warning("Fingerprint failed: %s", e)
        return None
