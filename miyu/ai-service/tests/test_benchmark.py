"""Бенчмарк для оценки качества транскрипции.

Запуск:
  python -m pytest tests/test_benchmark.py -v --tb=long
  python tests/test_benchmark.py --track 34 --config baseline

Сравнивает распознанный текст с эталонным, считает WER/CER/coverage.
"""
from __future__ import annotations

import argparse
import difflib
import json
import logging
import re
import sys
import time
from pathlib import Path
from typing import Optional

# Добавляем корень ai-service в sys.path
_HERE = Path(__file__).resolve().parent
_AI_SERVICE = _HERE.parent
if str(_AI_SERVICE) not in sys.path:
    sys.path.insert(0, str(_AI_SERVICE))

logger = logging.getLogger(__name__)

# Регулярка для нормализации текста
_WHITESPACE_RE = re.compile(r"\s+")
_PUNCTUATION_RE = re.compile(r"[^\w\s'`-]", re.UNICODE)
_EQUIVALENT_RE = re.compile(r"[ёе]", re.IGNORECASE)  # ё=е for accuracy comparison
_PARENTHESES_RE = re.compile(r"[\(\[].*?[\)\]]")

# Эталонные тексты (загружаются из файлов)
_GROUND_TRUTH_DIR = _HERE / "ground_truth"


def normalize_text(text: str) -> str:
    """Приводит текст к единому формату для сравнения."""
    text = text.lower().strip()
    text = _PARENTHESES_RE.sub("", text)  # убираем (куплет), [припев] и т.д.
    text = _PUNCTUATION_RE.sub("", text)
    text = _EQUIVALENT_RE.sub("е", text)  # ё -> е
    text = _WHITESPACE_RE.sub(" ", text)
    return text.strip()


def tokenize(text: str) -> list[str]:
    """Разбивает текст на слова."""
    return normalize_text(text).split()


def compute_wer(reference: str, hypothesis: str) -> dict:
    """Word Error Rate через динамическое выравнивание (Levenshtein на словах).

    Returns:
        dict с wer, insertions, deletions, substitutions, reference_len, hypothesis_len
    """
    ref_tokens = tokenize(reference)
    hyp_tokens = tokenize(hypothesis)

    n = len(ref_tokens)
    m = len(hyp_tokens)

    if n == 0 and m == 0:
        return {"wer": 0.0, "cer": 0.0, "insertions": 0, "deletions": 0,
                "substitutions": 0, "reference_len": 0, "hypothesis_len": 0,
                "recall": 1.0, "precision": 1.0, "f1": 1.0}

    if n == 0:
        return {"wer": float(m), "cer": 0.0, "insertions": m, "deletions": 0,
                "substitutions": 0, "reference_len": 0, "hypothesis_len": m,
                "recall": 0.0, "precision": 0.0, "f1": 0.0}

    # DP matrix для WER
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        d[i][0] = i
    for j in range(m + 1):
        d[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if ref_tokens[i - 1] == hyp_tokens[j - 1] else 1
            d[i][j] = min(
                d[i - 1][j] + 1,      # deletion
                d[i][j - 1] + 1,      # insertion
                d[i - 1][j - 1] + cost,  # substitution
            )

    # Backtrace для подсчета insertions/deletions/substitutions
    i, j = n, m
    insertions = deletions = substitutions = 0
    while i > 0 or j > 0:
        if i > 0 and j > 0 and d[i][j] == d[i - 1][j - 1] + (0 if ref_tokens[i - 1] == hyp_tokens[j - 1] else 1):
            if ref_tokens[i - 1] != hyp_tokens[j - 1]:
                substitutions += 1
            i -= 1
            j -= 1
        elif i > 0 and d[i][j] == d[i - 1][j] + 1:
            deletions += 1
            i -= 1
        elif j > 0 and d[i][j] == d[i][j - 1] + 1:
            insertions += 1
            j -= 1
        else:
            # fallback
            if i > 0:
                deletions += 1
                i -= 1
            if j > 0:
                insertions += 1
                j -= 1

    wer = d[n][m] / n

    # Character Error Rate
    ref_chars = normalize_text(reference).replace(" ", "")
    hyp_chars = normalize_text(hypothesis).replace(" ", "")
    cer = _levenshtein_chars(ref_chars, hyp_chars) / max(len(ref_chars), 1)

    # Recall: сколько слов эталона найдено в гипотезе
    ref_set = set(ref_tokens)
    hyp_set = set(hyp_tokens)
    true_positives = len(ref_set & hyp_set)
    recall = true_positives / len(ref_set) if ref_set else 1.0
    precision = true_positives / len(hyp_set) if hyp_set else 1.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "wer": round(wer, 4),
        "cer": round(cer, 4),
        "insertions": insertions,
        "deletions": deletions,
        "substitutions": substitutions,
        "reference_len": n,
        "hypothesis_len": m,
        "recall": round(recall, 4),
        "precision": round(precision, 4),
        "f1": round(f1, 4),
    }


def _levenshtein_chars(a: str, b: str) -> int:
    """Расстояние Левенштейна для строк (по символам)."""
    n, m = len(a), len(b)
    if n == 0:
        return m
    if m == 0:
        return n
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        d[i][0] = i
    for j in range(m + 1):
        d[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    return d[n][m]


def load_ground_truth(track_id: int) -> Optional[str]:
    """Загружает эталонный текст трека из файла."""
    # Пробуем точный файл
    exact = _GROUND_TRUTH_DIR / f"track_{track_id}.txt"
    if exact.exists():
        return exact.read_text(encoding="utf-8").strip()
    # Пробуем по имени
    for f in _GROUND_TRUTH_DIR.glob("*.txt"):
        stem = f.stem
        if stem.startswith(f"track_{track_id}"):
            return f.read_text(encoding="utf-8").strip()
    return None


def build_diff_report(reference: str, hypothesis: str) -> str:
    """Строит построчный diff."""
    ref_lines = [l.strip() for l in reference.split("\n") if l.strip()]
    hyp_lines = [l.strip() for l in hypothesis.split("\n") if l.strip()]

    diff = difflib.unified_diff(
        ref_lines, hyp_lines,
        fromfile="expected", tofile="transcribed",
        lineterm="",
    )
    return "\n".join(diff)


# ==================== Pytest integration ====================

import pytest


def _run_transcription(audio_path: str, config_name: str = "baseline",
                       language: Optional[str] = None) -> dict:
    """Запускает транскрипцию с заданным конфигом."""
    from app.analysis.transcription_params import get_config
    from app.analysis import transcription

    config = get_config(config_name)

    # Сохраняем конфиг во временную глобальную переменную для transcription
    transcription._ACTIVE_CONFIG = config

    try:
        result = transcription.transcribe(
            audio_path,
            vad=config.vad_enabled,
            language=language,
            initial_prompt=config.initial_prompt if language != "ru" else config.russian_initial_prompt,
        )
        return result
    finally:
        transcription._ACTIVE_CONFIG = None


class BenchmarkResult:
    """Результат одного прогона бенчмарка."""

    def __init__(self, track_id: int, track_name: str, config_name: str,
                 audio_path: str, expected_text: str, language: Optional[str] = None):
        self.track_id = track_id
        self.track_name = track_name
        self.config_name = config_name
        self.audio_path = audio_path
        self.expected_text = expected_text
        self.language = language
        self.transcription: Optional[dict] = None
        self.metrics: Optional[dict] = None
        self.duration_sec: float = 0.0
        self.transcription_time: float = 0.0
        self.error: Optional[str] = None

    def run(self):
        """Выполняет прогон."""
        from app.analysis import transcription
        from app.analysis.transcription_params import get_config

        config = get_config(self.config_name)
        transcription._ACTIVE_CONFIG = config

        logger.info(f"\n{'='*60}")
        logger.info(f"Запуск: {self.track_name} | config={self.config_name}")
        logger.info(f"Описание: {config.description}")
        logger.info(f"{'='*60}")

        t0 = time.time()
        try:
            lang = self.language
            prompt = config.initial_prompt
            # Для русских треков язык не форсируем — автодетекция
            result = transcription.transcribe(
                self.audio_path,
                vad=config.vad_enabled,
                language=lang,
                initial_prompt=prompt,
            )
            self.transcription_time = time.time() - t0
            self.transcription = result
            self.duration_sec = float(result.get("duration", 0))

            recognized = result.get("text", "")
            self.metrics = compute_wer(self.expected_text, recognized)

        except Exception as e:
            self.transcription_time = time.time() - t0
            self.error = str(e)
            logger.exception(f"Transcription failed: {e}")

        transcription._ACTIVE_CONFIG = None

    def report(self) -> str:
        """Генерирует текстовый отчёт."""
        lines = []
        lines.append(f"{'='*70}")
        lines.append(f"ОТЧЁТ БЕНЧМАРКА: {self.track_name}")
        lines.append(f"{'='*70}")
        lines.append(f"  Конфиг:        {self.config_name}")
        lines.append(f"  Время транскр.: {self.transcription_time:.1f}с")
        lines.append(f"  Длит. трека:   {self.duration_sec:.1f}с")

        if self.error:
            lines.append(f"  ОШИБКА: {self.error}")
            lines.append(f"{'='*70}\n")
            return "\n".join(lines)

        m = self.metrics
        lines.append(f"")
        lines.append(f"  ▸ WER (Word Error Rate):  {m['wer']*100:.1f}%  (чем ниже, тем лучше)")
        lines.append(f"  ▸ CER (Char Error Rate):  {m['cer']*100:.1f}%")
        lines.append(f"  ▸ Recall:                {m['recall']*100:.1f}%")
        lines.append(f"  ▸ Precision:             {m['precision']*100:.1f}%")
        lines.append(f"  ▸ F1:                    {m['f1']*100:.1f}%")
        lines.append(f"  ▸ Accuracy (1-WER):      {(1-m['wer'])*100:.1f}%")
        lines.append(f"")
        lines.append(f"  Подробно:")
        lines.append(f"    - Слов в эталоне:      {m['reference_len']}")
        lines.append(f"    - Слов распознано:     {m['hypothesis_len']}")
        lines.append(f"    - Вставки (лишние):    {m['insertions']}")
        lines.append(f"    - Удаления (пропуски): {m['deletions']}")
        lines.append(f"    - Замены (ошибки):     {m['substitutions']}")
        lines.append(f"")

        # Coverage по сегментам
        segments = self.transcription.get("segments", [])
        total_covered = 0
        for seg in segments:
            start = float(seg.get("start", 0))
            end = float(seg.get("end", 0))
            total_covered += (end - start)
        coverage = total_covered / max(self.duration_sec, 1)
        lines.append(f"  ▸ Coverage (время с речью): {coverage*100:.1f}%")
        lines.append(f"  ▸ Сегментов: {len(segments)}")

        # Структура сегментов по времени
        if segments:
            lines.append(f"")
            lines.append(f"  Структура сегментов:")
            for i, seg in enumerate(segments):
                text = str(seg.get("text", "")).strip()
                start = float(seg.get("start", 0))
                end = float(seg.get("end", 0))
                if text and len(text) > 3:
                    preview = text[:80] + ("..." if len(text) > 80 else "")
                    lines.append(f"    [{i+1:2d}] {start:6.1f}s-{end:6.1f}s | {preview}")

        lines.append(f"")

        # Diff
        recognized = self.transcription.get("text", "")
        diff = build_diff_report(self.expected_text, recognized)
        if diff:
            lines.append(f"  DIFF (expected vs transcribed):")
            lines.append(f"  ---")
            for dline in diff.split("\n")[:60]:  # первые 60 строк
                if dline.startswith("---") or dline.startswith("+++") or dline.startswith("@@"):
                    continue
                if dline.startswith("-"):
                    lines.append(f"  {dline}")
                elif dline.startswith("+"):
                    lines.append(f"  {dline}")
                else:
                    pass  # контекст не показываем для краткости
            lines.append(f"  ---")

        lines.append(f"{'='*70}\n")
        return "\n".join(lines)


def run_benchmark(track_id: int, config_name: str = "baseline",
                  audio_path: Optional[str] = None,
                  language: Optional[str] = None) -> BenchmarkResult:
    """Запускает полный бенчмарк для трека."""
    from app.analysis import transcription

    # Определяем путь к аудио
    if audio_path is None:
        # Пробуем вычислить по данным из БД
        import sqlite3
        from app.config import get_settings
        db_path = get_settings().db_path
        conn = sqlite3.connect(str(db_path))
        cur = conn.cursor()
        cur.execute("SELECT t.title, t.file_path, u.username FROM tracks t JOIN users u ON t.artist_id = u.id WHERE t.id = ?", (track_id,))
        row = cur.fetchone()
        conn.close()
        if row is None:
            raise ValueError(f"Track {track_id} not found in DB")
        track_name = f"{row[2]} - {row[0]}"
        raw_path = row[1]
        audio_path = str(_resolve_path_for_benchmark(raw_path))
    else:
        track_name = Path(audio_path).stem

    # Загружаем эталон
    expected = load_ground_truth(track_id)
    if expected is None:
        # Пробуем загрузить из БД (manual lyrics)
        import sqlite3
        from app.config import get_settings
        db_path = get_settings().db_path
        conn = sqlite3.connect(str(db_path))
        cur = conn.cursor()
        cur.execute("SELECT title, username, lyrics FROM tracks t JOIN users u ON t.artist_id = u.id WHERE t.id = ?", (track_id,))
        row = cur.fetchone()
        conn.close()
        if row and row[2]:
            expected = row[2].strip()
            track_name = f"{row[1]} - {row[0]}"
        else:
            raise ValueError(f"No ground truth for track {track_id}")

    result = BenchmarkResult(track_id, track_name, config_name, audio_path, expected, language)
    result.run()
    return result


def _resolve_path_for_benchmark(file_path: str) -> Path:
    """Резолвит путь к аудиофайлу для бенчмарка."""
    from pathlib import Path
    import os
    p = Path(file_path)
    # Если абсолютный и существует
    if p.exists():
        return p
    # Берём только имя файла
    fname = Path(file_path).name
    # Пробуем uploads/tracks (основное хранилище)
    uploads_tracks = Path(__file__).resolve().parent.parent.parent / "uploads" / "tracks"
    candidate = uploads_tracks / fname
    if candidate.exists():
        return candidate
    # Пробуем uploads/
    uploads = Path(__file__).resolve().parent.parent.parent / "uploads"
    candidate2 = uploads / fname
    if candidate2.exists():
        return candidate2
    # Пробуем backend/uploads/tracks (для обратной совместимости)
    be = Path(__file__).resolve().parent.parent.parent / "backend" / "uploads" / "tracks"
    candidate3 = be / fname
    if candidate3.exists():
        return candidate3
    return p


# ==================== Pytest-based тесты ====================

@pytest.mark.parametrize("track_id,config_name", [
    (34, "baseline"),
])
def test_benchmark_track(request, track_id, config_name):
    """Бенчмарк для трека с заданным конфигом."""
    result = run_benchmark(track_id, config_name)
    # Печатаем отчёт
    report = result.report()
    print(report)

    # Сохраняем результат
    output_dir = _HERE / "benchmark_results"
    output_dir.mkdir(exist_ok=True)
    output_file = output_dir / f"track_{track_id}_{config_name}.json"

    output_data = {
        "track_id": track_id,
        "track_name": result.track_name,
        "config_name": config_name,
        "metrics": result.metrics,
        "transcription_time": result.transcription_time,
        "duration_sec": result.duration_sec,
        "segments_count": len(result.transcription.get("segments", [])) if result.transcription else 0,
        "recognized_text": result.transcription.get("text", "") if result.transcription else "",
        "error": result.error,
    }
    output_file.write_text(json.dumps(output_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nРезультат сохранён: {output_file}")

    # Проверяем, что нет ошибки
    assert result.error is None, f"Transcription failed: {result.error}"
    # Минимальная проверка: accuracy не должна быть нулевой
    if result.metrics:
        assert result.metrics["recall"] > 0.1, f"Recall too low: {result.metrics['recall']}"


# ==================== CLI ====================

def main():
    """CLI entry point: python tests/test_benchmark.py --track 34 --config baseline"""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    parser = argparse.ArgumentParser(description="Бенчмарк транскрипции")
    parser.add_argument("--track", type=int, required=True, help="ID трека")
    parser.add_argument("--config", type=str, default="baseline", help="Имя конфига")
    parser.add_argument("--audio", type=str, default=None, help="Путь к аудиофайлу (опционально)")
    parser.add_argument("--lang", type=str, default=None, help="Язык (опционально)")

    # Также можно запустить все конфиги
    parser.add_argument("--all-configs", action="store_true", help="Прогнать все конфиги")

    args = parser.parse_args()

    if args.all_configs:
        from app.analysis.transcription_params import list_configs
        configs = list_configs()
        print(f"\nПрогоняю все конфиги ({len(configs)} шт): {configs}\n")
        results = []
        for cfg_name in configs:
            print(f"\n>>> Конфиг: {cfg_name}")
            result = run_benchmark(args.track, cfg_name, args.audio, args.lang)
            print(result.report())
            results.append(result)

        # Сводка
        print(f"\n{'='*70}")
        print(f"СВОДКА ПО ВСЕМ КОНФИГАМ")
        print(f"{'='*70}")
        print(f"{'Конфиг':20s} | {'WER%':8s} | {'Recall%':8s} | {'F1%':8s} | {'Время':8s}")
        print(f"{'-'*20}+{'-'*10}+{'-'*10}+{'-'*10}+{'-'*10}")
        for r in results:
            if r.metrics:
                print(f"{r.config_name:20s} | {r.metrics['wer']*100:7.1f}% | {r.metrics['recall']*100:7.1f}% | {r.metrics['f1']*100:7.1f}% | {r.transcription_time:7.1f}s")
        print()
    else:
        result = run_benchmark(args.track, args.config, args.audio, args.lang)
        print(result.report())


if __name__ == "__main__":
    main()
