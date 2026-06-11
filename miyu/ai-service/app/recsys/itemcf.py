"""Lite item-item Collaborative Filtering на co-occurrence.

Идея (Фаза 4-lite, до полноценного ALS):
1. Берём «положительные» события каждого пользователя:
      likes + добавления в свой плейлист.
   (Плеи не берём — слишком шумно для lite-варианта.)
2. Для каждого пользователя получаем set его позитивных треков `U`.
3. Co-occurrence: count(i, j) = #пользователей, у которых i ∈ U И j ∈ U.
4. Похожесть как нормализованный косинус на бинарной user-item матрице:
      sim(i, j) = co(i, j) / sqrt(c(i) * c(j))
   где c(i) = #пользователей, лайкнувших i.
5. Для каждого item храним top-N соседей (default 50).
6. Рекомендация для пользователя:
      score(j) = Σ_{i ∈ U_user} sim(i, j),  j ∉ U_user
   (Sparse-агрегация — берём только соседей лайкнутых треков.)

Снапшот пишется в `data/itemcf_index.pkl`. Перестроение —
ручной API call или ночной cron в worker.

Этот модуль:
- весь алгоритм оформлен ЧИСТЫМИ функциями (без БД) для надёжного теста;
- БД-обёртка строит снапшот один раз и кеширует в памяти;
- интеграция в feed — через `recommend_for_user`.
"""
from __future__ import annotations

import logging
import math
import os
import pickle
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Iterable

from .. import db

logger = logging.getLogger(__name__)

DEFAULT_TOP_NEIGHBORS = 50
MIN_COOCCURRENCE = 2          # \u0438\u0433\u043d\u043e\u0440\u0438\u0440\u0443\u0435\u043c \u043f\u0430\u0440\u044b, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0432\u0441\u0442\u0440\u0435\u0442\u0438\u043b\u0438\u0441\u044c \u0443 1 \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430
SNAPSHOT_PATH = os.environ.get("ITEMCF_SNAPSHOT", "data/itemcf_index.pkl")


# ============================================================================
# CHISTÝE FUNKTSII (testirujem bez BD)
# ============================================================================

@dataclass
class ItemCFIndex:
    """Снапшот: для каждого item_id — топ-N соседей (отсортированы по sim DESC)."""
    neighbors: dict[int, list[tuple[int, float]]] = field(default_factory=dict)
    item_freq: dict[int, int] = field(default_factory=dict)
    n_users: int = 0
    built_at: float = 0.0

    @property
    def size(self) -> int:
        return len(self.neighbors)


def build_index_from_user_items(
    user_items: dict[int, set[int]],
    top_neighbors: int = DEFAULT_TOP_NEIGHBORS,
    min_cooccurrence: int = MIN_COOCCURRENCE,
) -> ItemCFIndex:
    """Строит индекс соседей по словарю `user_id -> set(item_ids)`.

    Чистая функция: всё, что нужно для теста — словарь.
    """
    item_freq: dict[int, int] = defaultdict(int)
    cooc: dict[int, dict[int, int]] = defaultdict(lambda: defaultdict(int))

    for items in user_items.values():
        items = list(items)
        for it in items:
            item_freq[int(it)] += 1
        # \u0412\u0441\u0435 \u043d\u0435\u0443\u043f\u043e\u0440\u044f\u0434\u043e\u0447\u0435\u043d\u043d\u044b\u0435 \u043f\u0430\u0440\u044b.
        for i in range(len(items)):
            a = int(items[i])
            row_a = cooc[a]
            for j in range(i + 1, len(items)):
                b = int(items[j])
                row_a[b] += 1
                cooc[b][a] += 1

    neighbors: dict[int, list[tuple[int, float]]] = {}
    for a, row in cooc.items():
        c_a = item_freq[a]
        if c_a == 0:
            continue
        scored: list[tuple[int, float]] = []
        for b, c_ab in row.items():
            if c_ab < min_cooccurrence:
                continue
            c_b = item_freq.get(b, 0)
            if c_b == 0:
                continue
            sim = c_ab / math.sqrt(c_a * c_b)
            scored.append((b, sim))
        if not scored:
            continue
        scored.sort(key=lambda kv: -kv[1])
        neighbors[a] = scored[:top_neighbors]

    return ItemCFIndex(
        neighbors=neighbors,
        item_freq=dict(item_freq),
        n_users=len(user_items),
        built_at=time.time(),
    )


def recommend_from_seen(
    seen_items: Iterable[int],
    index: ItemCFIndex,
    limit: int = 100,
    exclude: Iterable[int] | None = None,
) -> list[tuple[int, float]]:
    """Кандидаты для пользователя: Σ sim для соседей лайкнутых треков.

    `exclude` — что не возвращать (например, дизлайки или прослушанное сегодня).
    """
    scores: dict[int, float] = defaultdict(float)
    seen = {int(i) for i in seen_items}
    excl = {int(i) for i in (exclude or ())} | seen
    for i in seen:
        row = index.neighbors.get(i)
        if not row:
            continue
        for j, sim in row:
            if j in excl:
                continue
            scores[j] += sim
    out = sorted(scores.items(), key=lambda kv: -kv[1])
    return out[:limit]


def similar_items(track_id: int, index: ItemCFIndex, limit: int = 10) -> list[tuple[int, float]]:
    """\u0422\u043e\u043f-N \u00ab\u043b\u044e\u0434\u0438 \u0442\u0430\u043a\u0436\u0435 \u043b\u044e\u0431\u044f\u0442\u00bb \u0434\u043b\u044f \u0442\u0440\u0435\u043a\u0430."""
    row = index.neighbors.get(int(track_id), [])
    return row[:limit]


# ============================================================================
# DB-OBERTKA + KESH SNAPSHOTA
# ============================================================================

_INDEX_CACHE: ItemCFIndex | None = None
_INDEX_CACHE_BUILT_AT: float = 0.0
_INDEX_TTL_SEC = 60 * 60 * 6  # 6 \u0447\u0430\u0441\u043e\u0432


def _fetch_user_items_from_db() -> dict[int, set[int]]:
    """\u041f\u043e\u0437\u0438\u0442\u0438\u0432\u043d\u044b\u0435 \u0441\u0438\u0433\u043d\u0430\u043b\u044b: likes + \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u0432 \u0441\u0432\u043e\u0439 \u043f\u043b\u0435\u0439\u043b\u0438\u0441\u0442."""
    user_items: dict[int, set[int]] = defaultdict(set)
    for r in db.fetch_all("SELECT user_id, track_id FROM likes"):
        user_items[int(r["user_id"])].add(int(r["track_id"]))
    for r in db.fetch_all(
        """
        SELECT p.user_id, pt.track_id
        FROM playlist_tracks pt
        JOIN playlists p ON p.id = pt.playlist_id
        """
    ):
        user_items[int(r["user_id"])].add(int(r["track_id"]))
    return user_items


def build_and_save_index(
    top_neighbors: int = DEFAULT_TOP_NEIGHBORS,
    min_cooccurrence: int = MIN_COOCCURRENCE,
) -> ItemCFIndex:
    """\u0427\u0438\u0442\u0430\u0435\u0442 \u0411\u0414, \u0441\u0442\u0440\u043e\u0438\u0442 \u0438\u043d\u0434\u0435\u043a\u0441, \u0441\u0431\u0440\u0430\u0441\u044b\u0432\u0430\u0435\u0442 \u0432 pickle, \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 \u0435\u0433\u043e."""
    global _INDEX_CACHE, _INDEX_CACHE_BUILT_AT
    user_items = _fetch_user_items_from_db()
    index = build_index_from_user_items(user_items, top_neighbors, min_cooccurrence)

    os.makedirs(os.path.dirname(SNAPSHOT_PATH) or ".", exist_ok=True)
    with open(SNAPSHOT_PATH, "wb") as f:
        pickle.dump(index, f, protocol=pickle.HIGHEST_PROTOCOL)
    logger.info(
        "itemcf index built: items=%d users=%d path=%s",
        index.size, index.n_users, SNAPSHOT_PATH,
    )

    _INDEX_CACHE = index
    _INDEX_CACHE_BUILT_AT = time.time()
    return index


def get_index(force_rebuild: bool = False) -> ItemCFIndex:
    """\u041b\u0435\u043d\u0438\u0432\u044b\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u0447\u0438\u043a: in-memory \u0438\u043b\u0438 \u0441 \u0434\u0438\u0441\u043a\u0430 \u0438\u043b\u0438 \u043f\u0435\u0440\u0435\u0441\u0442\u0440\u043e\u0438\u0442\u044c."""
    global _INDEX_CACHE, _INDEX_CACHE_BUILT_AT
    if force_rebuild:
        return build_and_save_index()

    if _INDEX_CACHE is not None and (time.time() - _INDEX_CACHE_BUILT_AT) < _INDEX_TTL_SEC:
        return _INDEX_CACHE

    if os.path.exists(SNAPSHOT_PATH):
        try:
            with open(SNAPSHOT_PATH, "rb") as f:
                _INDEX_CACHE = pickle.load(f)
            _INDEX_CACHE_BUILT_AT = time.time()
            logger.info("itemcf index loaded from %s (items=%d)", SNAPSHOT_PATH, _INDEX_CACHE.size)
            return _INDEX_CACHE
        except Exception as e:
            logger.warning("failed to load itemcf snapshot: %s — rebuilding", e)

    return build_and_save_index()


def stats() -> dict:
    idx = get_index()
    return {
        "size": idx.size,
        "n_users": idx.n_users,
        "built_at": idx.built_at,
        "snapshot_path": SNAPSHOT_PATH,
        "exists": os.path.exists(SNAPSHOT_PATH),
    }


# ---------------------------------------------------------- public for feed ---

def recommend_for_user(user_id: int, limit: int = 200) -> list[tuple[int, float]]:
    """Возвращает (track_id, score) для пользователя по его лайкам/плейлистам."""
    rows = db.fetch_all(
        "SELECT track_id FROM likes WHERE user_id = ?", (user_id,),
    ) + db.fetch_all(
        """
        SELECT pt.track_id FROM playlist_tracks pt
        JOIN playlists p ON p.id = pt.playlist_id
        WHERE p.user_id = ?
        """,
        (user_id,),
    )
    seen = {int(r["track_id"]) for r in rows}
    if not seen:
        return []
    idx = get_index()
    return recommend_from_seen(seen, idx, limit=limit)
