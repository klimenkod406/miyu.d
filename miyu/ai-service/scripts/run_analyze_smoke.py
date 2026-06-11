"""Smoke-runner анализатора (librosa-фичи + опционально Whisper/Detoxify/e5).

Базовый режим (без флагов) — только librosa-фичи (bpm/key/loudness/energy/...).
С флагом --text дополнительно:
  * транскрипция текста (faster-whisper)
  * токсичность (Detoxify)
  * text_embedding (sentence-transformers / multilingual-e5-small)

Использование (из корня репо, PowerShell):
    $env:MIYU_AI_DB_PATH = "c:\\Users\\Денис\\Desktop\\miyu\\database\\miyu.db"
    $env:MIYU_AI_STORAGE_ROOT = "c:\\Users\\Денис\\Desktop\\miyu"
    $env:PYTHONPATH = "c:\\Users\\Денис\\Desktop\\miyu\\ai-service"
    python ai-service/scripts/run_analyze_smoke.py [--text] 2 3 19

Если track_id не указан — обрабатываются все треки из tracks.
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

# Ensure ai-service on sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import db  # noqa: E402
from app.analysis import aggregator, audio_features, repository  # noqa: E402
from app.config import get_settings  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("smoke")


def _resolve_path(file_path: str) -> Path:
    p = Path(file_path)
    if p.is_absolute() and p.exists():
        return p
    root = get_settings().storage_root
    cand = root / file_path.lstrip("/").lstrip("\\")
    if cand.exists():
        return cand
    cand2 = root / "tracks" / Path(file_path).name
    if cand2.exists():
        return cand2
    return p


def analyze_one(track_id: int, with_text: bool = False) -> dict:
    settings = get_settings()
    track = repository.get_track(track_id)
    if track is None:
        return {"track_id": track_id, "error": "track not found"}

    audio_path = _resolve_path(track["file_path"])
    if not audio_path.exists():
        return {"track_id": track_id, "error": f"file not found: {audio_path}"}

    log.info("analyzing track %s: %s (text=%s)", track_id, audio_path, with_text)

    flags_extra: list[str] = []
    invalid_audio = False
    try:
        feats = audio_features.extract(str(audio_path))
        if feats.duration_sec < 20 or feats.duration_sec > 20 * 60:
            invalid_audio = True
            flags_extra.append("invalid_audio")
        features_dict = feats.asdict()
    except Exception as e:
        log.exception("audio_features failed: %s", e)
        invalid_audio = True
        features_dict = {
            "bpm": None, "key": None, "loudness": None, "energy": None,
            "danceability": None, "valence": None, "acousticness": None,
            "instrumentalness": None, "speechiness": None,
            "duration_sec": 0.0, "sample_rate": 0,
        }

    # --- Text pipeline (optional) ---
    lyrics_text: str | None = None
    lyrics_language: str | None = None
    toxicity: dict = {}
    is_explicit_lyrics = False
    text_emb = None
    if with_text and not invalid_audio:
        from app.analysis import text_moderation, transcription  # noqa: WPS433
        try:
            log.info("transcribing (this may take 1-3 min on CPU)...")
            tr = transcription.transcribe(str(audio_path))
            lyrics_text = (tr.get("text") or "").strip() or None
            lyrics_language = tr.get("language")
            log.info("lyrics: lang=%s chars=%d", lyrics_language, len(lyrics_text or ""))
        except Exception as e:
            log.exception("transcription failed: %s", e)
        if lyrics_text:
            try:
                toxicity = text_moderation.toxicity_scores(lyrics_text)
                log.info("toxicity: %s",
                         {k: round(v, 3) for k, v in (toxicity or {}).items()})
            except Exception as e:
                log.exception("toxicity failed: %s", e)
            try:
                is_explicit_lyrics = text_moderation.is_explicit(lyrics_text)
            except Exception:
                pass
            try:
                text_emb = text_moderation.embed(lyrics_text)
                if text_emb is not None:
                    log.info("text_embedding: dim=%d", int(text_emb.shape[0]))
            except Exception as e:
                log.exception("text embed failed: %s", e)

    signals = aggregator.ModerationSignals(
        toxicity=toxicity or None,
        is_explicit=is_explicit_lyrics,
        nsfw_cover=0.0,
        invalid_audio=invalid_audio,
        possible_duplicate=False,
        duplicate_score=0.0,
        artist_is_verified=bool(track.get("artist_is_verified")),
    )
    decision = aggregator.aggregate(signals)
    for f in flags_extra:
        if f not in decision.ai_flags:
            decision.ai_flags.append(f)

    summary_parts = []
    if features_dict.get("bpm"):
        summary_parts.append(f"BPM={features_dict['bpm']}")
    if features_dict.get("key"):
        summary_parts.append(f"key={features_dict['key']}")
    if lyrics_language:
        summary_parts.append(f"lang={lyrics_language}")
    if decision.ai_flags:
        summary_parts.append("flags=" + ",".join(decision.ai_flags))
    summary = "; ".join(summary_parts) or "n/a"

    version_tag = f"{settings.analysis_version}-smoke" + ("+text" if with_text else "")
    repository.upsert_track_analysis(
        track_id,
        features=features_dict,
        mood_tags=[],
        genre_tags=[],
        audio_embedding=None,
        text_embedding=text_emb,
        lyrics_text=lyrics_text,
        lyrics_language=lyrics_language,
        fingerprint=None,
        decision=decision,
        summary=summary,
        analysis_version=version_tag,
    )

    final_status = repository.apply_moderation_decision(
        track_id,
        submitted_by=int(track["artist_id"]),
        decision=decision,
        auto_approve_limit_reached=False,
    )

    return {
        "track_id": track_id,
        "ai_score": decision.ai_score,
        "ai_flags": decision.ai_flags,
        "decision": decision.decision,
        "final_status": final_status,
        "summary": summary,
        "duration_sec": features_dict.get("duration_sec"),
        "bpm": features_dict.get("bpm"),
        "key": features_dict.get("key"),
        "lyrics_language": lyrics_language,
        "lyrics_chars": len(lyrics_text or ""),
        "toxicity_max": (
            round(max(float(v) for v in toxicity.values()), 4) if toxicity else None
        ),
        "has_text_embedding": text_emb is not None,
    }


def main() -> int:
    args = sys.argv[1:]
    with_text = "--text" in args
    args = [a for a in args if not a.startswith("--")]
    if args:
        ids = [int(a) for a in args]
    else:
        rows = db.fetch_all("SELECT id FROM tracks ORDER BY id")
        ids = [int(r["id"]) for r in rows]

    log.info("processing %d tracks (with_text=%s): %s", len(ids), with_text, ids)
    results = []
    for tid in ids:
        try:
            r = analyze_one(tid, with_text=with_text)
        except Exception as e:
            log.exception("analyze failed for %s", tid)
            r = {"track_id": tid, "error": str(e)}
        results.append(r)
        log.info("done: %s", r)

    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    for r in results:
        print(r)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
