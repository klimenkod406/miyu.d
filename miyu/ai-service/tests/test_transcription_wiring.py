from __future__ import annotations

from pathlib import Path

from types import SimpleNamespace

from app.analysis import pipeline, repository, transcription
from app.config import get_settings
from app import db


def test_get_track_returns_genre(tmp_path, monkeypatch):
    get_settings.cache_clear()
    db_path = tmp_path / "miyu.db"
    monkeypatch.setenv("MIYU_AI_DB_PATH", str(db_path))

    with db.connect() as conn:
        conn.executescript(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                is_verified INTEGER DEFAULT 0
            );
            CREATE TABLE tracks (
                id INTEGER PRIMARY KEY,
                artist_id INTEGER NOT NULL,
                album_id INTEGER,
                title TEXT NOT NULL,
                file_path TEXT NOT NULL,
                cover_url TEXT,
                lyrics TEXT,
                genre TEXT
            );
            INSERT INTO users (id, is_verified) VALUES (1, 1);
            INSERT INTO tracks (id, artist_id, title, file_path, genre)
            VALUES (10, 1, 'Song', 'track.mp3', 'rap');
            """
        )

    track = repository.get_track(10)

    assert track is not None
    assert track["genre"] == "rap"


def test_load_passes_configured_num_workers(monkeypatch):
    get_settings.cache_clear()
    transcription._MODEL = None
    monkeypatch.setenv("MIYU_AI_WHISPER_MODEL", "tiny")
    monkeypatch.setenv("MIYU_AI_WHISPER_DEVICE", "cpu")
    monkeypatch.setenv("MIYU_AI_WHISPER_COMPUTE_TYPE", "int8")
    monkeypatch.setenv("MIYU_AI_WHISPER_NUM_WORKERS", "2")

    captured = {}

    class FakeWhisperModel:
        def __init__(self, model, **kwargs):
            captured["model"] = model
            captured.update(kwargs)

    import faster_whisper

    monkeypatch.setattr(faster_whisper, "WhisperModel", FakeWhisperModel)

    transcription._load()

    assert captured == {
        "model": "tiny",
        "device": "cpu",
        "compute_type": "int8",
        "num_workers": 2,
    }
    get_settings.cache_clear()


def test_lyrics_prompt_uses_tagged_genre_before_stored_genre():
    prompt = pipeline._lyrics_initial_prompt(
        {"genre": None},
        [{"tag": "rap", "score": 0.91}],
    )

    assert prompt == "Rap lyrics, hip-hop music with rhymes."


def test_lyrics_prompt_supports_russian_stored_genre_label():
    prompt = pipeline._lyrics_initial_prompt(
        {"genre": "Хип-хоп"},
        [],
    )

    assert prompt == "Rap lyrics, hip-hop music with rhymes."


def test_retake_replacement_clears_stale_word_timestamps(monkeypatch):
    transcription._MODEL = None

    class FakeModel:
        def transcribe(self, file_path, **kwargs):
            if kwargs.get("language") == "en":
                replacement = SimpleNamespace(start=0.0, end=1.0, text="hello", words=None)
                return [replacement], SimpleNamespace(language="en", language_probability=1.0, duration=1.0)

            segments = [
                SimpleNamespace(
                    start=0.0,
                    end=0.6,
                    text="Привет",
                    words=[SimpleNamespace(word="Привет", start=0.0, end=0.6, probability=0.4)],
                ),
                SimpleNamespace(start=0.7, end=1.0, text="world", words=None),
                SimpleNamespace(start=1.1, end=1.4, text="again", words=None),
            ]
            info = SimpleNamespace(language="en", language_probability=1.0, duration=1.4)
            return segments, info

    monkeypatch.setattr(transcription, "_load", lambda: FakeModel())
    monkeypatch.setattr(transcription.subprocess, "run", lambda *args, **kwargs: SimpleNamespace(returncode=0, stderr=""))
    monkeypatch.setattr(transcription.Path, "exists", lambda self: True)

    result = transcription.transcribe("track.mp3", vad=False)

    assert result["segments"][0]["text"] == "hello"
    assert result["segments"][0]["words"] is None


def test_transcribe_retries_with_soft_vad_when_coverage_is_low(monkeypatch):
    calls = []

    class FakeModel:
        def transcribe(self, file_path, **kwargs):
            calls.append(kwargs)
            if len(calls) == 1:
                segments = [SimpleNamespace(start=0.0, end=40.0, text="коротко", words=None)]
                return segments, SimpleNamespace(language="ru", language_probability=0.96, duration=100.0)

            segments = [SimpleNamespace(start=0.0, end=92.0, text="полный текст", words=None)]
            return segments, SimpleNamespace(language="ru", language_probability=1.0, duration=100.0)

    monkeypatch.setattr(transcription, "_load", lambda: FakeModel())

    result = transcription.transcribe("track.mp3", vad=True, language="ru")

    assert result["text"] == "полный текст"
    assert len(calls) == 2
    assert calls[1]["language"] == "ru"
    assert calls[1]["vad_parameters"] == {
        "threshold": 0.15,
        "min_speech_duration_ms": 100,
        "min_silence_duration_ms": 300,
        "speech_pad_ms": 500,
    }
    assert calls[1]["initial_prompt"] == "Текст русской песни. Куплет, припев, повторяющиеся строки, музыка на фоне."


def test_transcribe_filters_low_confidence_latin_segments_in_russian_track(monkeypatch):
    class FakeModel:
        def transcribe(self, file_path, **kwargs):
            segments = [
                SimpleNamespace(
                    start=0.0,
                    end=1.0,
                    text="Обниматься крепче",
                    words=[SimpleNamespace(word="Обниматься", start=0.0, end=0.5, probability=0.92)],
                ),
                SimpleNamespace(
                    start=1.0,
                    end=2.0,
                    text="I stayed away from the night",
                    words=[SimpleNamespace(word="stayed", start=1.0, end=1.4, probability=0.11)],
                ),
                SimpleNamespace(
                    start=2.0,
                    end=3.0,
                    text="Во в aj",
                    words=[
                        SimpleNamespace(word="Во", start=2.0, end=2.3, probability=0.1),
                        SimpleNamespace(word="в", start=2.3, end=2.4, probability=0.9),
                        SimpleNamespace(word="aj", start=2.4, end=3.0, probability=0.95),
                    ],
                ),
            ]
            return segments, SimpleNamespace(language="ru", language_probability=1.0, duration=3.0)

    monkeypatch.setattr(transcription, "_load", lambda: FakeModel())

    result = transcription.transcribe("track.mp3", vad=True, language="ru")

    assert result["text"] == "Обниматься крепче"
    assert len(result["segments"]) == 1


def test_transcribe_filters_repeated_syllable_and_credits_hallucinations(monkeypatch):
    class FakeModel:
        def transcribe(self, file_path, **kwargs):
            segments = [
                SimpleNamespace(start=0.0, end=1.0, text="Без остатка раствориться", words=None),
                SimpleNamespace(start=1.0, end=2.0, text="На-на-на-на-на-на-на-на-на-на-на", words=None),
                SimpleNamespace(start=2.0, end=3.0, text="Нам, нам, нам, нам, нам, нам, нам...", words=None),
                SimpleNamespace(start=3.0, end=4.0, text="Туда, куда, куда, куда, куда, куда, куда...", words=None),
                SimpleNamespace(start=4.0, end=5.0, text="Так, так, так..", words=None),
                SimpleNamespace(start=5.0, end=6.0, text="Редактор субтитров А.Олзоева Корректор А.Кулакова", words=None),
            ]
            return segments, SimpleNamespace(language="ru", language_probability=1.0, duration=3.0)

    monkeypatch.setattr(transcription, "_load", lambda: FakeModel())

    result = transcription.transcribe("track.mp3", vad=True, language="ru")

    assert result["text"] == "Без остатка раствориться"
    assert len(result["segments"]) == 1


def test_transcribe_uses_clean_tail_when_filtered_soft_vad_coverage_is_low(monkeypatch):
    calls = []

    class FakeModel:
        def transcribe(self, file_path, **kwargs):
            calls.append(kwargs)
            if len(calls) == 1:
                segments = [SimpleNamespace(start=0.0, end=40.0, text="коротко", words=None)]
                return segments, SimpleNamespace(language="ru", language_probability=1.0, duration=100.0)

            segments = [
                SimpleNamespace(start=0.0, end=70.0, text="основной текст", words=None),
                SimpleNamespace(start=90.0, end=96.0, text="Так, так, так..", words=None),
                SimpleNamespace(start=96.0, end=98.0, text="чистый хвост", words=None),
            ]
            return segments, SimpleNamespace(language="ru", language_probability=1.0, duration=100.0)

    monkeypatch.setattr(transcription, "_load", lambda: FakeModel())

    result = transcription.transcribe("track.mp3", vad=True, language="ru")

    assert result["segments"][-1]["end"] == 98.0
    assert result["text"].endswith("чистый хвост")
    assert "Так" not in result["text"]
