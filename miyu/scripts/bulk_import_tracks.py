from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import unicodedata
import uuid
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = REPO_ROOT / "database" / "miyu.db"
DEFAULT_UPLOADS_DIR = REPO_ROOT / "uploads" / "tracks"
DEFAULT_SOURCE_DIR = Path("/root/miyu-import/tracks")
ALLOWED_EXTENSIONS = {".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".opus"}
DEFAULT_AI_BASE_URL = "http://127.0.0.1:8001"

CONFUSABLE_LATIN_TO_CYRILLIC = str.maketrans({
    "A": "А", "a": "а",
    "B": "В", "E": "Е", "e": "е",
    "K": "К", "k": "к",
    "M": "М", "m": "м",
    "H": "Н", "h": "һ",
    "O": "О", "o": "о",
    "P": "Р", "p": "р",
    "C": "С", "c": "с",
    "T": "Т", "t": "т",
    "X": "Х", "x": "х",
    "Y": "У", "y": "у",
})


@dataclass
class ArtistRecord:
    id: int
    username: str


@dataclass
class ParsedTrack:
    source_path: Path
    artist_name: str
    track_title: str
    extension: str


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_artist_name(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = value.replace("ё", "е").replace("Ё", "Е")
    value = value.replace("–", "-").replace("—", "-")
    value = value.replace("’", "'").replace("`", "'")
    value = value.replace("&", " and ")
    value = value.translate(CONFUSABLE_LATIN_TO_CYRILLIC)
    value = normalize_whitespace(value)
    value = value.casefold()
    value = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE)
    value = value.replace("-", " ")
    value = normalize_whitespace(value)
    return value


def normalize_track_title(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = value.replace("ё", "е").replace("Ё", "Е")
    value = value.replace("–", "-").replace("—", "-")
    value = value.replace("’", "'").replace("`", "'")
    value = normalize_whitespace(value)
    value = re.sub(r"\s*\((\d+)\)$", "", value)
    value = normalize_whitespace(value)
    return value


def parse_filename(file_path: Path) -> ParsedTrack | None:
    if file_path.suffix.lower() not in ALLOWED_EXTENSIONS:
        return None
    stem = file_path.stem
    match = re.match(r"^\s*(.+?)\s+-\s+(.+?)\s*$", stem)
    if not match:
        match = re.match(r"^\s*(.+?)\s*-\s*(.+?)\s*$", stem)
    if not match:
        return None
    artist_name = normalize_whitespace(match.group(1))
    track_title = normalize_track_title(match.group(2))
    if not artist_name or not track_title:
        return None
    return ParsedTrack(
        source_path=file_path,
        artist_name=artist_name,
        track_title=track_title,
        extension=file_path.suffix.lower(),
    )


def load_artists(conn: sqlite3.Connection) -> tuple[dict[str, ArtistRecord], dict[str, list[str]]]:
    rows = conn.execute(
        "SELECT id, username FROM users WHERE role = 'artist' ORDER BY id"
    ).fetchall()
    artist_lookup: dict[str, ArtistRecord] = {}
    collisions: dict[str, list[str]] = {}
    for artist_id, username in rows:
        normalized = normalize_artist_name(str(username))
        record = ArtistRecord(id=int(artist_id), username=str(username))
        if normalized in artist_lookup:
            collisions.setdefault(normalized, [artist_lookup[normalized].username]).append(record.username)
        else:
            artist_lookup[normalized] = record
    return artist_lookup, collisions


def load_existing_tracks(conn: sqlite3.Connection) -> dict[tuple[int, str], int]:
    rows = conn.execute("SELECT id, artist_id, title FROM tracks").fetchall()
    existing: dict[tuple[int, str], int] = {}
    for track_id, artist_id, title in rows:
        existing[(int(artist_id), normalize_track_title(str(title)).casefold())] = int(track_id)
    return existing


def get_duration_seconds(file_path: Path) -> int:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(file_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        message = (result.stderr or result.stdout or "ffprobe failed").strip()
        raise RuntimeError(message)
    raw = (result.stdout or "").strip()
    duration = float(raw)
    rounded = max(1, int(round(duration)))
    return rounded


def copy_track_file(source_path: Path, uploads_dir: Path) -> str:
    uploads_dir.mkdir(parents=True, exist_ok=True)
    unique_name = f"{int.from_bytes(os.urandom(6), 'big')}-{uuid.uuid4().hex[:10]}{source_path.suffix.lower()}"
    destination = uploads_dir / unique_name
    shutil.copy2(source_path, destination)
    return unique_name


def enqueue_ai_analysis(track_id: int, file_path: str, ai_base_url: str) -> tuple[bool, str]:
    url = ai_base_url.rstrip("/") + "/analyze/enqueue"
    payload = json.dumps({"track_id": track_id, "file_path": file_path}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8", errors="replace")
            try:
                data = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                data = {"raw": raw}
            job_id = str(data.get("job_id") or "")
            queue = str(data.get("queue") or "")
            detail = f"job_id={job_id}" if job_id else "enqueued"
            if queue:
                detail += f" queue={queue}"
            return True, detail
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        return False, f"HTTP {error.code}: {body[:300]}"
    except Exception as error:
        return False, str(error)


def main() -> int:
    parser = argparse.ArgumentParser(description="Bulk import tracks into Miyu without AI analysis")
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--uploads-dir", type=Path, default=DEFAULT_UPLOADS_DIR)
    parser.add_argument("--mode", choices=["dry-run", "import"], default="dry-run")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--status", choices=["pending", "approved"], default="approved")
    parser.add_argument("--enqueue-ai", action="store_true")
    parser.add_argument("--ai-base-url", default=DEFAULT_AI_BASE_URL)
    args = parser.parse_args()

    if not args.source_dir.exists() or not args.source_dir.is_dir():
        print(f"ERROR: source dir not found: {args.source_dir}")
        return 1

    if not args.db_path.exists():
        print(f"ERROR: database not found: {args.db_path}")
        return 1

    files = sorted([path for path in args.source_dir.iterdir() if path.is_file()])
    if args.limit > 0:
        files = files[: args.limit]

    conn = sqlite3.connect(args.db_path)
    conn.row_factory = sqlite3.Row

    artist_lookup, collisions = load_artists(conn)
    existing_tracks = load_existing_tracks(conn)

    if collisions:
        print("WARN: normalized artist name collisions detected:")
        for normalized, names in collisions.items():
            print(f"  {normalized}: {', '.join(names)}")

    imported = 0
    skipped_duplicates = 0
    skipped_missing_artist = 0
    skipped_parse_errors = 0
    skipped_duration_errors = 0
    enqueue_success = 0
    enqueue_failed = 0
    planned = 0

    print(f"MODE: {args.mode}")
    print(f"SOURCE: {args.source_dir}")
    print(f"DB: {args.db_path}")
    print(f"UPLOADS: {args.uploads_dir}")
    print(f"FILES FOUND: {len(files)}")
    print(f"TRACK STATUS: {args.status}")
    print(f"ENQUEUE AI: {'yes' if args.enqueue_ai else 'no'}")
    if args.enqueue_ai:
        print(f"AI BASE URL: {args.ai_base_url}")
    print()

    try:
        for file_path in files:
            parsed = parse_filename(file_path)
            if parsed is None:
                skipped_parse_errors += 1
                print(f"[SKIP:PARSE] {file_path.name}")
                continue

            normalized_artist = normalize_artist_name(parsed.artist_name)
            artist = artist_lookup.get(normalized_artist)
            if artist is None:
                skipped_missing_artist += 1
                print(f"[SKIP:ARTIST] {file_path.name} -> artist not found: {parsed.artist_name}")
                continue

            existing_track_id = existing_tracks.get((artist.id, parsed.track_title.casefold()))
            if existing_track_id is not None:
                skipped_duplicates += 1
                print(
                    f"[SKIP:DUPLICATE] {file_path.name} -> {artist.username} / {parsed.track_title} (track_id={existing_track_id})"
                )
                continue

            try:
                duration = get_duration_seconds(file_path)
            except Exception as error:
                skipped_duration_errors += 1
                print(f"[SKIP:DURATION] {file_path.name} -> {error}")
                continue

            planned += 1

            if args.mode == "dry-run":
                print(
                    f"[PLAN] {file_path.name} -> artist='{artist.username}' title='{parsed.track_title}' duration={duration}s"
                )
                continue

            copied_name = copy_track_file(file_path, args.uploads_dir)
            db_file_path = f"/uploads/tracks/{copied_name}"

            try:
                cursor = conn.execute(
                    """
                    INSERT INTO tracks (
                        artist_id, album_id, title, duration, track_number, file_path, file_path_hd,
                        cover_url, genre, bpm, key, lyrics, is_explicit, is_premium, status, created_at, updated_at
                    ) VALUES (?, NULL, ?, ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    (artist.id, parsed.track_title, duration, db_file_path, args.status),
                )
                conn.commit()
                track_id = int(cursor.lastrowid)
                imported += 1
                existing_tracks[(artist.id, parsed.track_title.casefold())] = track_id
                enqueue_note = ""
                if args.enqueue_ai:
                    ok, detail = enqueue_ai_analysis(track_id, db_file_path, args.ai_base_url)
                    if ok:
                        enqueue_success += 1
                        enqueue_note = f" ai=queued({detail})"
                    else:
                        enqueue_failed += 1
                        enqueue_note = f" ai=FAILED({detail})"
                print(
                    f"[IMPORTED] {file_path.name} -> track_id={track_id} artist='{artist.username}' title='{parsed.track_title}' duration={duration}s status='{args.status}' file='{copied_name}'{enqueue_note}"
                )
            except Exception:
                destination = args.uploads_dir / copied_name
                if destination.exists():
                    destination.unlink()
                raise
    finally:
        conn.close()

    print()
    print("SUMMARY")
    print(f"  planned/importable: {planned}")
    print(f"  imported: {imported}")
    print(f"  skipped duplicates: {skipped_duplicates}")
    print(f"  skipped missing artist: {skipped_missing_artist}")
    print(f"  skipped parse errors: {skipped_parse_errors}")
    print(f"  skipped duration errors: {skipped_duration_errors}")
    print(f"  ai enqueue success: {enqueue_success}")
    print(f"  ai enqueue failed: {enqueue_failed}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
