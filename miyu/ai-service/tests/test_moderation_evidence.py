from __future__ import annotations

from app.analysis.moderation_evidence import build_moderation_evidence
from app import db
from app.api.analysis_router import get_track_moderation_evidence
from app.config import get_settings


def test_explicit_lyrics_create_fragment_evidence():
    result = build_moderation_evidence({
        "track_id": 10,
        "ai_score": 0.31,
        "ai_flags": ["explicit_lyrics"],
        "lyrics_text": "первая строка\nбля плохое слово\nтретья строка",
        "lyrics_language": "ru",
        "segments": [
            {"start": 10.0, "end": 14.0, "text": "бля плохое слово"},
        ],
    })

    item = result["evidence"][0]
    assert item["type"] == "lyrics_explicit"
    assert item["severity"] == "warning"
    assert item["count"] >= 1
    assert item["fragments"][0]["start"] == 10.0
    assert item["fragments"][0]["end"] == 14.0
    assert "бля" in item["fragments"][0]["matched_words"]
    assert result["summary"]["warning_count"] >= 1


def test_slur_is_red_evidence():
    result = build_moderation_evidence({
        "track_id": 11,
        "ai_score": 0.85,
        "ai_flags": ["hate_slur"],
        "lyrics_text": "хач в тексте",
        "segments": [],
    })

    assert result["summary"]["decision"] == "flag"
    assert any(item["type"] == "lyrics_explicit" and item["severity"] == "red" for item in result["evidence"])


def test_drug_reference_creates_drug_evidence():
    result = build_moderation_evidence({
        "track_id": 12,
        "ai_score": 0.4,
        "ai_flags": ["drug_reference"],
        "lyrics_text": "нюхаю кокаин ночью",
        "segments": [{"start": 1.0, "end": 3.0, "text": "нюхаю кокаин ночью"}],
    })

    drug = next(item for item in result["evidence"] if item["type"] == "drug_reference")
    assert drug["severity"] == "warning"
    assert drug["fragments"][0]["start"] == 1.0
    assert drug["fragments"][0]["matched_words"]


def test_non_text_flags_create_evidence_without_fragments():
    result = build_moderation_evidence({
        "track_id": 13,
        "ai_score": 0.91,
        "ai_flags": ["invalid_audio", "possible_duplicate", "nsfw_cover", "suggestive_cover"],
        "lyrics_text": "",
        "segments": [],
    })

    types = [item["type"] for item in result["evidence"]]
    assert types[:3] == ["invalid_audio", "nsfw_cover", "duplicate"]
    assert all("fragments" not in item or item["fragments"] == [] for item in result["evidence"])
    assert result["summary"]["decision"] == "flag"
    assert result["summary"]["red_count"] >= 3


def test_clean_analysis_returns_approve_summary_and_empty_evidence():
    result = build_moderation_evidence({
        "track_id": 14,
        "ai_score": 0.05,
        "ai_flags": [],
        "lyrics_text": "чистый текст песни",
        "segments": [],
    })

    assert result["summary"] == {
        "decision": "approve",
        "score": 0.05,
        "reasons": [],
        "red_count": 0,
        "warning_count": 0,
        "info_count": 0,
    }
    assert result["evidence"] == []


def test_track_moderation_evidence_endpoint_reads_saved_analysis(tmp_path, monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("MIYU_AI_DB_PATH", str(tmp_path / "miyu.db"))
    with db.connect() as conn:
        conn.executescript(
            """
            CREATE TABLE track_analysis (
                track_id INTEGER PRIMARY KEY,
                ai_score REAL,
                ai_flags TEXT,
                lyrics_text TEXT,
                lyrics_language TEXT,
                segments_json TEXT,
                analysis_version TEXT
            );
            INSERT INTO track_analysis (
                track_id, ai_score, ai_flags, lyrics_text, lyrics_language, segments_json, analysis_version
            ) VALUES (
                22,
                0.42,
                '["explicit_lyrics"]',
                'бля в строке',
                'ru',
                '[{"start":3.0,"end":5.0,"text":"бля в строке"}]',
                'v1'
            );
            """
        )

    result = get_track_moderation_evidence(22)

    assert result["track_id"] == 22
    assert result["summary"]["decision"] == "pending"
    assert result["evidence"][0]["fragments"][0]["start"] == 3.0
    get_settings.cache_clear()
