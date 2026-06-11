"""Тестовый скрипт для проверки транскрипции."""
import sys
import json
from pathlib import Path

# Добавляем путь к модулю
sys.path.insert(0, str(Path(__file__).parent))

from app.analysis import transcription

def main():
    # Путь к тестовому файлу
    audio_path = Path(__file__).parent.parent / "backend" / "uploads" / "tracks" / "1776791615983-755819135.mp3"

    if not audio_path.exists():
        print(f"Файл не найден: {audio_path}")
        return

    print(f"Анализ файла: {audio_path.name}")
    print("=" * 80)

    # Запускаем транскрипцию
    result = transcription.transcribe(str(audio_path))

    # Выводим результаты
    print(f"\nЯзык: {result['language']} (вероятность: {result['language_prob']:.2%})")
    print(f"Длительность: {result['duration']:.1f} сек")
    print(f"\nРаспознанный текст:")
    print("-" * 80)
    print(result['text'])
    print("-" * 80)

    # Выводим сегменты с таймингами
    print(f"\nСегменты ({len(result['segments'])} шт.):")
    for i, seg in enumerate(result['segments'][:5], 1):  # первые 5 для примера
        print(f"\n[{i}] {seg['start']:.1f}s - {seg['end']:.1f}s")
        print(f"    Текст: {seg['text']}")
        if seg.get('words'):
            print(f"    Слова ({len(seg['words'])} шт.):")
            for word in seg['words'][:10]:  # первые 10 слов
                print(f"      {word['start']:.2f}s: {word['word']} (p={word['probability']:.2f})")

    if len(result['segments']) > 5:
        print(f"\n... и ещё {len(result['segments']) - 5} сегментов")

    # Сохраняем полный результат в JSON
    output_path = Path(__file__).parent.parent / ".openclaude-transcription-result.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\n\nПолный результат сохранён в: {output_path.name}")

if __name__ == "__main__":
    main()
