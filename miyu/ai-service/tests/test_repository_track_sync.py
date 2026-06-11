from __future__ import annotations

from dataclasses import dataclass

from app import db
from app.analysis import repository
from app.config import get_settings


@dataclass
class Decision:
    ai_score: float = 0.42
    ai_flags: list[str] | None = None
    decision: str = "pending"

    def __post_init__(self) -> None:
        if self.ai_flags is None:
            self.ai_flags = ["explicit_lyrics"]


def test_upsert_track_analysis_syncs_public_track_fields(tmp_path, monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("MIYU_AI_DB_PATH", str(tmp_path / "miyu.db"))

    with db.connect() as conn:
        conn.executescript(
            """
            CREATE TABLE tracks (
                id INTEGER PRIMARY KEY,
                duration INTEGER NOT NULL DEFAULT 0,
                bpm INTEGER,
                key TEXT,
                lyrics TEXT,
                is_explicit INTEGER DEFAULT 0,
                genre TEXT,
                updated_at TEXT
            );
            CREATE TABLE track_analysis (
                track_id INTEGER PRIMARY KEY,
                mood_tags TEXT,
                bpm REAL,
                key TEXT,
                danceability REAL,
                energy REAL,
                valence REAL,
                acousticness REAL,
                instrumentalness REAL,
                speechiness REAL,
                loudness REAL,
                genre_tags TEXT,
                audio_embedding BLOB,
                text_embedding BLOB,
                fingerprint TEXT,
                analysis_version TEXT,
                ai_score REAL,
                ai_flags TEXT,
                lyrics_text TEXT,
                lyrics_language TEXT,
                segments_json TEXT,
                analysis_summary TEXT,
                updated_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO tracks (id, duration, bpm, key, lyrics, is_explicit, genre)
            VALUES (7, 0, NULL, NULL, NULL, 0, NULL);
            """
        )

    repository.upsert_track_analysis(
        7,
        features={
            "duration_sec": 201.6,
            "bpm": 128.4,
            "key": "A",
            "danceability": 0.7,
            "energy": 0.8,
            "valence": 0.6,
            "acousticness": 0.2,
            "instrumentalness": 0.1,
            "speechiness": 0.3,
            "loudness": -8.5,
        },
        mood_tags=["energetic"],
        genre_tags=[{"tag": "electronic", "prob": 0.92}],
        audio_embedding=None,
        text_embedding=None,
        lyrics_text="explicit lyrics text",
        lyrics_language="en",
        fingerprint="abc",
        decision=Decision(),
        summary="summary",
        analysis_version="v1",
        segments=[],
    )

    with db.connect() as conn:
        row = conn.execute(
            "SELECT duration, bpm, key, lyrics, is_explicit, genre FROM tracks WHERE id = 7"
        ).fetchone()

    assert dict(row) == {
        "duration": 202,
        "bpm": 128,
        "key": "A",
        "lyrics": "explicit lyrics text",
        "is_explicit": 1,
        "genre": "Электроника",
    }
    get_settings.cache_clear()


def test_upsert_track_analysis_preserves_manual_duration_genre_and_clean_explicit(tmp_path, monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("MIYU_AI_DB_PATH", str(tmp_path / "miyu.db"))

    with db.connect() as conn:
        conn.executescript(
            """
            CREATE TABLE tracks (
                id INTEGER PRIMARY KEY,
                duration INTEGER NOT NULL DEFAULT 0,
                bpm INTEGER,
                key TEXT,
                lyrics TEXT,
                is_explicit INTEGER DEFAULT 0,
                genre TEXT,
                updated_at TEXT
            );
            CREATE TABLE track_analysis (
                track_id INTEGER PRIMARY KEY,
                mood_tags TEXT,
                bpm REAL,
                key TEXT,
                danceability REAL,
                energy REAL,
                valence REAL,
                acousticness REAL,
                instrumentalness REAL,
                speechiness REAL,
                loudness REAL,
                genre_tags TEXT,
                audio_embedding BLOB,
                text_embedding BLOB,
                fingerprint TEXT,
                analysis_version TEXT,
                ai_score REAL,
                ai_flags TEXT,
                lyrics_text TEXT,
                lyrics_language TEXT,
                segments_json TEXT,
                analysis_summary TEXT,
                updated_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO tracks (id, duration, bpm, key, lyrics, is_explicit, genre)
            VALUES (8, 180, NULL, NULL, 'manual lyrics', 1, 'Авторский жанр');
            """
        )

    repository.upsert_track_analysis(
        8,
        features={"duration_sec": 220.0, "bpm": 90, "key": "C"},
        mood_tags=[],
        genre_tags=[{"tag": "pop", "prob": 0.9}],
        audio_embedding=None,
        text_embedding=None,
        lyrics_text=None,
        lyrics_language=None,
        fingerprint=None,
        decision=Decision(ai_score=0.05, ai_flags=[], decision="approve"),
        summary="clean",
        analysis_version="v1",
        segments=[],
    )

    with db.connect() as conn:
        row = conn.execute(
            "SELECT duration, bpm, key, lyrics, is_explicit, genre FROM tracks WHERE id = 8"
        ).fetchone()

    assert dict(row) == {
        "duration": 180,
        "bpm": 90,
        "key": "C",
        "lyrics": "manual lyrics",
        "is_explicit": 0,
        "genre": "Авторский жанр",
    }
    get_settings.cache_clear()


def test_select_primary_genre_uses_highest_valid_normalized_tag():
    genre_tags = [
        {"tag": "speech", "prob": 0.99},
        {"tag": "electronic", "prob": 0.41},
        {"tag": "rock", "prob": 0.73},
    ]

    assert repository._select_primary_genre(genre_tags) == "Рок"


def test_select_primary_genre_allows_new_detected_genre_labels():
    genre_tags = [
        {"tag": "speech", "prob": 0.99},
        {"tag": "phonk", "prob": 0.61},
    ]

    assert repository._select_primary_genre(genre_tags) == "Phonk"


def test_select_primary_genre_supports_ai_normalized_labels():
    assert repository._select_primary_genre([{"tag": "lo-fi", "prob": 0.44}]) == "Lo-fi"
    assert repository._select_primary_genre([{"tag": "soul music", "prob": 0.44}]) == "Соул"
    assert repository._select_primary_genre([{"tag": "ambient music", "prob": 0.44}]) == "Эмбиент"


def create_analysis_schema(conn):
    conn.executescript(
        """
        CREATE TABLE tracks (
            id INTEGER PRIMARY KEY,
            duration INTEGER NOT NULL DEFAULT 0,
            bpm INTEGER,
            key TEXT,
            lyrics TEXT,
            is_explicit INTEGER DEFAULT 0,
            genre TEXT,
            updated_at TEXT
        );
        CREATE TABLE track_analysis (
            track_id INTEGER PRIMARY KEY,
            mood_tags TEXT,
            bpm REAL,
            key TEXT,
            danceability REAL,
            energy REAL,
            valence REAL,
            acousticness REAL,
            instrumentalness REAL,
            speechiness REAL,
            loudness REAL,
            genre_tags TEXT,
            audio_embedding BLOB,
            text_embedding BLOB,
            fingerprint TEXT,
            analysis_version TEXT,
            ai_score REAL,
            ai_flags TEXT,
            lyrics_text TEXT,
            lyrics_language TEXT,
            segments_json TEXT,
            analysis_summary TEXT,
            updated_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """
    )


def test_upsert_track_analysis_assigns_genres_to_multiple_empty_tracks(tmp_path, monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("MIYU_AI_DB_PATH", str(tmp_path / "miyu.db"))

    with db.connect() as conn:
        create_analysis_schema(conn)
        conn.executescript(
            """
            INSERT INTO tracks (id, duration, bpm, key, lyrics, is_explicit, genre)
            VALUES (11, 0, NULL, NULL, NULL, 0, NULL),
                   (12, 0, NULL, NULL, NULL, 0, 'Авторский жанр'),
                   (13, 0, NULL, NULL, NULL, 0, '');
            """
        )

    base_kwargs = dict(
        features={"duration_sec": 180, "bpm": 100, "key": "C"},
        mood_tags=[],
        audio_embedding=None,
        text_embedding=None,
        lyrics_text=None,
        lyrics_language=None,
        fingerprint=None,
        decision=Decision(ai_score=0.05, ai_flags=[], decision="approve"),
        summary="clean",
        analysis_version="v1",
        segments=[],
    )

    repository.upsert_track_analysis(11, genre_tags=[{"tag": "pop", "prob": 0.8}], **base_kwargs)
    repository.upsert_track_analysis(12, genre_tags=[{"tag": "rock", "prob": 0.8}], **base_kwargs)
    repository.upsert_track_analysis(13, genre_tags=[{"tag": "ambient music", "prob": 0.8}], **base_kwargs)

    with db.connect() as conn:
        rows = conn.execute("SELECT id, genre FROM tracks ORDER BY id").fetchall()

    assert [dict(row) for row in rows] == [
        {"id": 11, "genre": "Поп"},
        {"id": 12, "genre": "Авторский жанр"},
        {"id": 13, "genre": "Эмбиент"},
    ]
    get_settings.cache_clear()


def test_upsert_track_analysis_assigns_fallback_genre_when_tagging_is_unavailable(tmp_path, monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("MIYU_AI_DB_PATH", str(tmp_path / "miyu.db"))

    with db.connect() as conn:
        create_analysis_schema(conn)
        conn.execute(
            "INSERT INTO tracks (id, duration, bpm, key, lyrics, is_explicit, genre) VALUES (21, 0, NULL, NULL, NULL, 0, NULL)"
        )

    repository.upsert_track_analysis(
        21,
        features={
            "duration_sec": 180,
            "bpm": 142,
            "key": "F",
            "danceability": 0.82,
            "energy": 0.86,
            "valence": 0.55,
            "acousticness": 0.08,
            "instrumentalness": 0.12,
            "speechiness": 0.05,
            "loudness": -7.0,
        },
        mood_tags=["neutral"],
        genre_tags=[],
        audio_embedding=None,
        text_embedding=None,
        lyrics_text=None,
        lyrics_language=None,
        fingerprint=None,
        decision=Decision(ai_score=0.05, ai_flags=[], decision="approve"),
        summary="clean",
        analysis_version="v1",
        segments=[],
    )

    with db.connect() as conn:
        row = conn.execute("SELECT genre FROM tracks WHERE id = 21").fetchone()

    assert dict(row) == {"genre": "Электроника"}
    get_settings.cache_clear()


def test_upsert_track_analysis_preserves_new_detected_genre_label(tmp_path, monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("MIYU_AI_DB_PATH", str(tmp_path / "miyu.db"))

    with db.connect() as conn:
        create_analysis_schema(conn)
        conn.execute(
            "INSERT INTO tracks (id, duration, bpm, key, lyrics, is_explicit, genre) VALUES (22, 0, NULL, NULL, NULL, 0, NULL)"
        )

    repository.upsert_track_analysis(
        22,
        features={"duration_sec": 180, "bpm": 120, "key": "A"},
        mood_tags=[],
        genre_tags=[{"tag": "phonk", "prob": 0.77}],
        audio_embedding=None,
        text_embedding=None,
        lyrics_text=None,
        lyrics_language=None,
        fingerprint=None,
        decision=Decision(ai_score=0.05, ai_flags=[], decision="approve"),
        summary="clean",
        analysis_version="v1",
        segments=[],
    )

    with db.connect() as conn:
        row = conn.execute("SELECT genre FROM tracks WHERE id = 22").fetchone()

    assert dict(row) == {"genre": "Phonk"}
    get_settings.cache_clear()
