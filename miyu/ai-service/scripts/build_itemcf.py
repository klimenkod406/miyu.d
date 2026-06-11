"""Оффлайн-сборка item-item CF индекса.

Запуск:
    python scripts/build_itemcf.py

Должен запускаться из корня ai-service. Положит снапшот в data/itemcf_index.pkl
(или путь из ITEMCF_SNAPSHOT env).
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

# Делаем приложение импортируемым.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.recsys import itemcf  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def main() -> None:
    idx = itemcf.build_and_save_index()
    print(f"itemcf index built: items={idx.size} users={idx.n_users}")
    print(f"snapshot: {itemcf.SNAPSHOT_PATH}")


if __name__ == "__main__":
    main()
