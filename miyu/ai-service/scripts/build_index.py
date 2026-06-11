"""Принудительный пересбор hnsw-индекса.

Использование:
    python scripts/build_index.py
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

# Добавляем корень ai-service в PYTHONPATH чтобы скрипт работал автономно.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.recsys import index as idx_mod  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def main() -> None:
    snap = idx_mod.get_index(force_rebuild=True)
    print(f"Index built. size={snap.size} dim={snap.dim} built_at={snap.built_at}")


if __name__ == "__main__":
    main()
