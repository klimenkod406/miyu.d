"""Оффлайн-оценка рекомендательных стратегий: Recall@K, NDCG@K, Coverage.

Time-based split:
  - history: лайки + плейлисты ДО cutoff (holdout_days назад от max-таймстампа).
  - holdout: лайки ПОСЛЕ cutoff (то, что пользователь добавил «в будущем»).

Метрики:
  - Recall@K = |recommended ∩ holdout| / |holdout|     (среднее по юзерам)
  - NDCG@K  = классический DCG/IDCG на бинарных релевантностях.
  - Coverage = доля каталога, попавшая хоть в одну топ-K выдачу.

Стратегии:
  - popularity: HN-trending по всему окну.
  - itemcf: lite-CF, индекс собран ТОЛЬКО на history (без утечки).

Запуск из корня ai-service:
    python scripts/eval_recsys.py [--k 10] [--holdout-days 14]
"""
from __future__ import annotations

import argparse
import math
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db  # noqa: E402
from app.recsys import itemcf, popularity  # noqa: E402

MIN_HISTORY_PER_USER = 3   # \u0438\u0433\u043d\u043e\u0440\u0438\u0440\u0443\u0435\u043c \u044e\u0437\u0435\u0440\u043e\u0432 \u0441 \u043e\u0447\u0435\u043d\u044c \u043c\u0430\u043b\u0435\u043d\u044c\u043a\u043e\u0439 \u0438\u0441\u0442\u043e\u0440\u0438\u0435\u0439
MIN_HOLDOUT_PER_USER = 1


def parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    s = s.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        try:
            dt = datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def collect_events() -> list[tuple[int, int, datetime]]:
    """Возвращает [(user_id, track_id, ts)] из likes + playlist_tracks."""
    out: list[tuple[int, int, datetime]] = []
    for r in db.fetch_all("SELECT user_id, track_id, created_at FROM likes"):
        ts = parse_dt(r["created_at"])
        if ts:
            out.append((int(r["user_id"]), int(r["track_id"]), ts))
    for r in db.fetch_all(
        """
        SELECT p.user_id, pt.track_id, pt.added_at
        FROM playlist_tracks pt JOIN playlists p ON p.id = pt.playlist_id
        """
    ):
        ts = parse_dt(r["added_at"])
        if ts:
            out.append((int(r["user_id"]), int(r["track_id"]), ts))
    return out


def split(events: list[tuple[int, int, datetime]], holdout_days: int):
    if not events:
        return {}, {}, None
    max_ts = max(ts for _, _, ts in events)
    cutoff = max_ts - __import__("datetime").timedelta(days=holdout_days)
    history: dict[int, set[int]] = defaultdict(set)
    holdout: dict[int, set[int]] = defaultdict(set)
    for u, t, ts in events:
        (history if ts <= cutoff else holdout)[u].add(t)
    # \u041e\u0442\u0431\u0440\u0430\u0441\u044b\u0432\u0430\u0435\u043c \u044e\u0437\u0435\u0440\u043e\u0432, \u0443 \u043a\u043e\u0442\u043e\u0440\u044b\u0445 \u043d\u0435\u0442 \u0438\u043b\u0438 \u0438\u0441\u0442\u043e\u0440\u0438\u0438, \u0438\u043b\u0438 holdout.
    valid_users = {
        u for u in (set(history) | set(holdout))
        if len(history.get(u, set())) >= MIN_HISTORY_PER_USER
        and len(holdout.get(u, set())) >= MIN_HOLDOUT_PER_USER
    }
    history = {u: history[u] for u in valid_users if u in history}
    holdout = {u: holdout[u] for u in valid_users if u in holdout}
    return history, holdout, cutoff


def dcg(rels: list[int]) -> float:
    return sum(r / math.log2(i + 2) for i, r in enumerate(rels))


def ndcg_at_k(predicted: list[int], relevant: set[int], k: int) -> float:
    rels = [1 if t in relevant else 0 for t in predicted[:k]]
    ideal = sorted(rels, reverse=True)
    idcg = dcg(ideal)
    return dcg(rels) / idcg if idcg > 0 else 0.0


def recall_at_k(predicted: list[int], relevant: set[int], k: int) -> float:
    if not relevant:
        return 0.0
    hits = sum(1 for t in predicted[:k] if t in relevant)
    return hits / len(relevant)


def evaluate(
    name: str,
    predict_fn,
    holdout: dict[int, set[int]],
    k: int,
    catalog_size: int,
) -> dict:
    recalls, ndcgs = [], []
    coverage_set: set[int] = set()
    for u, true_items in holdout.items():
        preds = predict_fn(u)[:k]
        coverage_set.update(preds)
        recalls.append(recall_at_k(preds, true_items, k))
        ndcgs.append(ndcg_at_k(preds, true_items, k))
    return {
        "strategy": name,
        "users": len(holdout),
        f"recall@{k}": sum(recalls) / len(recalls) if recalls else 0.0,
        f"ndcg@{k}":   sum(ndcgs) / len(ndcgs) if ndcgs else 0.0,
        "coverage": len(coverage_set) / catalog_size if catalog_size else 0.0,
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--k", type=int, default=10)
    p.add_argument("--holdout-days", type=int, default=14)
    args = p.parse_args()

    print(f"==> Collecting events...")
    events = collect_events()
    if not events:
        print("No events found — nothing to evaluate.")
        return
    print(f"   total events: {len(events)}")

    history, holdout, cutoff = split(events, args.holdout_days)
    print(f"   cutoff: {cutoff}")
    print(f"   eligible users (>={MIN_HISTORY_PER_USER} hist, >={MIN_HOLDOUT_PER_USER} holdout): {len(holdout)}")
    if not holdout:
        print("Not enough data for evaluation.")
        return

    catalog = {t for _, t, _ in events}
    catalog_size = len(catalog)

    # 1) popularity: считаем за окно history (без holdout!).
    pop_sorted = popularity.popular_track_ids(limit=200)  # глобальная HN
    pop_top = [tid for tid, _ in pop_sorted]
    def predict_pop(u: int) -> list[int]:
        seen = history.get(u, set())
        return [t for t in pop_top if t not in seen]

    # 2) item-CF: индекс собран ТОЛЬКО на history.
    cf_index = itemcf.build_index_from_user_items(history)
    def predict_cf(u: int) -> list[int]:
        seen = history.get(u, set())
        if not seen:
            return []
        recs = itemcf.recommend_from_seen(seen, cf_index, limit=200)
        return [t for t, _ in recs]

    rows = [
        evaluate("popularity", predict_pop, holdout, args.k, catalog_size),
        evaluate("itemcf",     predict_cf,  holdout, args.k, catalog_size),
    ]

    print()
    print(f"=== Offline eval (k={args.k}, holdout_days={args.holdout_days}) ===")
    cols = ["strategy", "users", f"recall@{args.k}", f"ndcg@{args.k}", "coverage"]
    widths = [max(len(c), max(len(str(r[c])) for r in rows)) for c in cols]
    print("| " + " | ".join(c.ljust(w) for c, w in zip(cols, widths)) + " |")
    print("|" + "|".join("-" * (w + 2) for w in widths) + "|")
    for r in rows:
        cells = []
        for c, w in zip(cols, widths):
            v = r[c]
            if isinstance(v, float):
                cells.append(f"{v:.4f}".ljust(w))
            else:
                cells.append(str(v).ljust(w))
        print("| " + " | ".join(cells) + " |")


if __name__ == "__main__":
    main()
