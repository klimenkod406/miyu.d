# AI Moderation Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build deterministic AI moderation evidence so admins can see why a track was sent to moderation, including exact lyrics fragments and non-text moderation signals.

**Architecture:** Add a focused ai-service evidence builder and endpoint that derives evidence from saved `track_analysis` data without new ML calls or schema changes. Proxy the endpoint through the existing backend `/api/ai` route, then render detailed evidence in `TrackModerationModal` and a compact preview in `AIAnalysisPanel`.

**Tech Stack:** Python/FastAPI ai-service, SQLite via existing `db` helpers, Express backend proxy, React + TypeScript frontend, lightweight Python pytest and Node assert tests.

---

## File structure

- Create `ai-service/app/analysis/moderation_evidence.py`
  - Owns evidence data shaping, text fragment extraction, severity sorting, and summary decision derivation.
  - Pure deterministic module. No model loading, no database calls.

- Create `ai-service/tests/test_moderation_evidence.py`
  - Unit tests for the builder using plain dictionaries and saved-analysis-like rows.

- Modify `ai-service/app/api/analysis_router.py`
  - Adds `GET /track/{track_id}/moderation-evidence`.
  - Reads the saved `track_analysis` row, parses JSON fields, calls the builder, returns JSON.

- Modify `backend/routes/ai.ts`
  - Adds backend proxy `GET /api/ai/tracks/:id/moderation-evidence`.

- Modify `frontend/src/api/ai.ts`
  - Adds TypeScript interfaces for moderation evidence and `getTrackModerationEvidence()`.

- Create `frontend/src/components/moderationEvidence.ts`
  - Pure frontend helpers: severity class mapping, timestamp formatting, matched-word highlighting.

- Create `frontend/src/components/moderationEvidence.test.mjs`
  - Node assert smoke tests for the pure helpers.

- Modify `frontend/src/components/TrackModerationModal.tsx`
  - Loads evidence on open.
  - Renders evidence timeline in the admin modal.
  - Clicking a timestamped fragment seeks the existing audio element.

- Modify `frontend/src/components/AIAnalysisPanel.tsx`
  - Loads evidence lazily when expanded.
  - Renders compact preview of top evidence reasons.

---

## Task 1: Build deterministic ai-service evidence builder

**Files:**
- Create: `ai-service/app/analysis/moderation_evidence.py`
- Create: `ai-service/tests/test_moderation_evidence.py`

- [ ] **Step 1: Write failing tests for explicit, drug, slur, non-text flags, and clean rows**

Create `ai-service/tests/test_moderation_evidence.py` with:

```python
from __future__ import annotations

from app.analysis.moderation_evidence import build_moderation_evidence


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
        "lyrics_text": "пидор в тексте",
        "segments": [],
    })

    assert result["summary"]["decision"] == "flag"
    assert any(item["type"] == "lyrics_explicit" and item["severity"] == "red" for item in result["evidence"])


def test_drug_reference_creates_drug_evidence():
    result = build_moderation_evidence({
        "track_id": 12,
        "ai_score": 0.4,
        "ai_flags": ["drug_reference"],
        "lyrics_text": "курим травку ночью",
        "segments": [{"start": 1.0, "end": 3.0, "text": "курим травку ночью"}],
    })

    drug = next(item for item in result["evidence"] if item["type"] == "drug_reference")
    assert drug["severity"] == "warning"
    assert drug["fragments"][0]["start"] == 1.0
    assert "травку" in drug["fragments"][0]["matched_words"]


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
```

- [ ] **Step 2: Run builder tests and verify they fail**

Run:

```bash
cd ai-service
.venv/Scripts/python.exe -m pytest tests/test_moderation_evidence.py -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.analysis.moderation_evidence'`.

- [ ] **Step 3: Implement the evidence builder**

Create `ai-service/app/analysis/moderation_evidence.py`:

```python
from __future__ import annotations

import re
from typing import Any

from ..config import get_settings
from .aggregator import RED_FLAGS
from .text_moderation import analyze_explicit

_FRAGMENT_LIMIT = 5
_CONTEXT_CHARS = 48
_SEVERITY_ORDER = {"red": 0, "warning": 1, "info": 2}
_TYPE_ORDER = {
    "invalid_audio": 0,
    "nsfw_cover": 1,
    "lyrics_explicit": 2,
    "drug_reference": 3,
    "toxicity": 4,
    "duplicate": 5,
    "audio_quality": 6,
    "general_flag": 7,
}

_FLAG_META = {
    "invalid_audio": ("invalid_audio", "red", "Некорректный аудиофайл", "Аудиофайл не прошёл pre-flight проверку: длительность или формат выглядят некорректно."),
    "possible_duplicate": ("duplicate", "red", "Возможный дубликат", "AI нашёл высокий риск совпадения с уже загруженным треком."),
    "nsfw_cover": ("nsfw_cover", "red", "NSFW-обложка", "Обложка получила высокий NSFW-риск."),
    "suggestive_cover": ("nsfw_cover", "warning", "Сомнительная обложка", "Обложка получила пограничный suggestive-риск."),
    "toxic": ("toxicity", "warning", "Токсичность", "Текст получил повышенный toxicity-риск."),
    "hate": ("toxicity", "red", "Hate-речь", "Текст получил высокий hate/toxicity-риск."),
}

_CATEGORY_META = {
    "severe": ("lyrics_explicit", "warning", "Нецензурный текст", "В тексте найдены грубые explicit-слова."),
    "moderate": ("lyrics_explicit", "warning", "Нецензурный текст", "В тексте найдены explicit-слова средней тяжести."),
    "mild": ("lyrics_explicit", "info", "Мягкая нецензурная лексика", "В тексте найдены мягкие explicit-слова."),
    "slur": ("lyrics_explicit", "red", "Оскорбления / slur", "В тексте найдены оскорбительные slur-выражения."),
    "drug": ("drug_reference", "warning", "Упоминание наркотиков", "В тексте найдено упоминание наркотиков в контексте употребления или распространения."),
}


def _text_window(text: str, start: int, end: int) -> dict[str, str]:
    before = text[max(0, start - _CONTEXT_CHARS):start].strip()
    after = text[end:min(len(text), end + _CONTEXT_CHARS)].strip()
    return {"context_before": before, "context_after": after}


def _find_segment(segments: list[dict[str, Any]], matched_word: str) -> dict[str, Any] | None:
    needle = matched_word.lower().replace("ё", "е")
    for segment in segments:
        text = str(segment.get("text") or "").lower().replace("ё", "е")
        if needle and needle in text:
            return segment
    return None


def _fragment(text: str, match: dict[str, Any], segments: list[dict[str, Any]]) -> dict[str, Any]:
    start = int(match.get("start") or 0)
    end = int(match.get("end") or start)
    word = str(match.get("word") or text[start:end])
    window = _text_window(text, start, end)
    fragment_text = f"{window['context_before']} {word} {window['context_after']}".strip()
    out: dict[str, Any] = {
        "text": re.sub(r"\s+", " ", fragment_text),
        "matched_words": [word],
        **window,
    }
    segment = _find_segment(segments, word)
    if segment is not None:
        out["start"] = float(segment.get("start") or 0.0)
        out["end"] = float(segment.get("end") or out["start"])
    return out


def _merge_severity(left: str, right: str) -> str:
    return left if _SEVERITY_ORDER[left] <= _SEVERITY_ORDER[right] else right


def _text_evidence(lyrics_text: str, segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not lyrics_text.strip():
        return []
    analysis = analyze_explicit(lyrics_text)
    grouped: dict[str, dict[str, Any]] = {}
    for match in analysis.matches:
        category = str(match.get("category") or "")
        if category not in _CATEGORY_META:
            continue
        item_type, severity, title, explanation = _CATEGORY_META[category]
        key = item_type if item_type == "drug_reference" else "lyrics_explicit"
        item = grouped.setdefault(key, {
            "type": item_type,
            "severity": severity,
            "title": title,
            "explanation": explanation,
            "score": analysis.score if item_type == "lyrics_explicit" else None,
            "count": 0,
            "fragments": [],
        })
        item["severity"] = _merge_severity(item["severity"], severity)
        if severity == "red":
            item["title"] = title
            item["explanation"] = explanation
        item["count"] += 1
        if len(item["fragments"]) < _FRAGMENT_LIMIT:
            item["fragments"].append(_fragment(lyrics_text, match, segments))
    return list(grouped.values())


def _flag_evidence(flags: list[str], ai_score: float | None) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    text_handled = {"explicit_lyrics", "explicit_heavy", "drug_reference", "hate_slur"}
    for flag in flags:
        if flag in text_handled:
            continue
        item_type, severity, title, explanation = _FLAG_META.get(
            flag,
            ("general_flag", "warning" if flag in RED_FLAGS else "info", flag, f"AI flag: {flag}"),
        )
        item: dict[str, Any] = {
            "type": item_type,
            "severity": severity,
            "title": title,
            "explanation": explanation,
        }
        if ai_score is not None:
            item["score"] = float(ai_score)
        items.append(item)
    return items


def _sort_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(items, key=lambda item: (_SEVERITY_ORDER[item["severity"]], _TYPE_ORDER.get(item["type"], 99)))


def build_moderation_evidence(payload: dict[str, Any]) -> dict[str, Any]:
    track_id = int(payload.get("track_id") or 0)
    ai_score = payload.get("ai_score")
    score = float(ai_score) if ai_score is not None else None
    flags = list(payload.get("ai_flags") or [])
    lyrics_text = str(payload.get("lyrics_text") or "")
    segments = list(payload.get("segments") or [])

    evidence = _sort_items(_text_evidence(lyrics_text, segments) + _flag_evidence(flags, score))
    red_count = sum(1 for item in evidence if item["severity"] == "red")
    warning_count = sum(1 for item in evidence if item["severity"] == "warning")
    info_count = sum(1 for item in evidence if item["severity"] == "info")

    if red_count > 0 or (score is not None and score >= get_settings().flag_threshold):
        decision = "flag"
    elif warning_count > 0:
        decision = "pending"
    elif score is None:
        decision = "unknown"
    else:
        decision = "approve"

    return {
        "track_id": track_id,
        "summary": {
            "decision": decision,
            "score": score,
            "reasons": [item["title"] for item in evidence],
            "red_count": red_count,
            "warning_count": warning_count,
            "info_count": info_count,
        },
        "evidence": evidence,
    }
```

- [ ] **Step 4: Run builder tests and verify they pass**

Run:

```bash
cd ai-service
.venv/Scripts/python.exe -m pytest tests/test_moderation_evidence.py -q
```

Expected: PASS, 5 tests passed.

- [ ] **Step 5: Run existing ai-service tests**

Run:

```bash
cd ai-service
.venv/Scripts/python.exe -m pytest tests -q
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add ai-service/app/analysis/moderation_evidence.py ai-service/tests/test_moderation_evidence.py
git commit -m "feat(ai): build moderation evidence"
```

---

## Task 2: Expose moderation evidence through ai-service and backend proxy

**Files:**
- Modify: `ai-service/app/api/analysis_router.py:129-166`
- Modify: `backend/routes/ai.ts:1-109`
- Test: `ai-service/tests/test_moderation_evidence.py`

- [ ] **Step 1: Add failing API-shape test for DB row conversion**

Append to `ai-service/tests/test_moderation_evidence.py`:

```python
from app import db
from app.api.analysis_router import get_track_moderation_evidence
from app.config import get_settings


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
```

- [ ] **Step 2: Run the new endpoint test and verify it fails**

Run:

```bash
cd ai-service
.venv/Scripts/python.exe -m pytest tests/test_moderation_evidence.py::test_track_moderation_evidence_endpoint_reads_saved_analysis -q
```

Expected: FAIL with `ImportError` or `AttributeError` because `get_track_moderation_evidence` does not exist.

- [ ] **Step 3: Add ai-service endpoint**

In `ai-service/app/api/analysis_router.py`, add this import near the existing imports or inside the function:

```python
from ..analysis.moderation_evidence import build_moderation_evidence
```

Add this endpoint after `get_track_lyrics`:

```python
@router.get("/track/{track_id}/moderation-evidence")
def get_track_moderation_evidence(track_id: int) -> dict[str, Any]:
    row = db.fetch_one(
        """
        SELECT track_id, ai_score, ai_flags, lyrics_text, lyrics_language, segments_json, analysis_version
        FROM track_analysis WHERE track_id = ?
        """,
        (track_id,),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="analysis not found")
    payload = dict(row)
    payload["ai_flags"] = db.from_json(payload.get("ai_flags"), default=[])
    payload["segments"] = db.from_json(payload.get("segments_json"), default=[])
    return build_moderation_evidence(payload)
```

- [ ] **Step 4: Run ai-service endpoint tests**

Run:

```bash
cd ai-service
.venv/Scripts/python.exe -m pytest tests/test_moderation_evidence.py -q
```

Expected: PASS.

- [ ] **Step 5: Add backend proxy route**

In `backend/routes/ai.ts`, update the header comment to include:

```ts
 * - GET    /api/ai/tracks/:id/moderation-evidence — detailed AI moderation evidence.
```

Add this route after `/tracks/:id/lyrics`:

```ts
router.get('/tracks/:id/moderation-evidence', authenticateToken, async (req: AuthRequest, res: Response) => {
  const trackId = parseInt(req.params.id as string);
  if (!Number.isFinite(trackId)) return res.status(400).json({ error: 'bad track id' });
  const r = await aiFetch(`/track/${trackId}/moderation-evidence`) as any;
  res.status(r.status).json(r.data);
});
```

- [ ] **Step 6: Run backend/frontend build smoke**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS. This also type-checks frontend TypeScript through the existing build command.

- [ ] **Step 7: Commit Task 2**

```bash
git add ai-service/app/api/analysis_router.py ai-service/tests/test_moderation_evidence.py backend/routes/ai.ts
git commit -m "feat(ai): expose moderation evidence endpoint"
```

---

## Task 3: Add frontend API types and pure evidence helpers

**Files:**
- Modify: `frontend/src/api/ai.ts:13-71`
- Create: `frontend/src/components/moderationEvidence.mjs`
- Create: `frontend/src/components/moderationEvidence.ts`
- Create: `frontend/src/components/moderationEvidence.test.mjs`

- [ ] **Step 1: Write failing helper tests**

Create `frontend/src/components/moderationEvidence.test.mjs`:

```js
import assert from 'node:assert/strict'
import { evidenceSeverityClass, formatEvidenceTimestamp, highlightMatchedWords } from './moderationEvidence.mjs'

assert.equal(formatEvidenceTimestamp(72.4), '1:12')
assert.equal(formatEvidenceTimestamp(undefined), '—')
assert.match(evidenceSeverityClass('red'), /red/)
assert.match(evidenceSeverityClass('warning'), /yellow/)
assert.match(evidenceSeverityClass('info'), /white/)
assert.equal(
  highlightMatchedWords('до бля после', ['бля']),
  'до <mark>бля</mark> после',
)

console.log('moderationEvidence tests passed')
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run:

```bash
cd frontend
node src/components/moderationEvidence.test.mjs
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement JS helper for tests**

Create `frontend/src/components/moderationEvidence.mjs`:

```js
export function formatEvidenceTimestamp(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—'
  const total = Math.max(0, Math.floor(Number(seconds)))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function evidenceSeverityClass(severity) {
  if (severity === 'red') return 'border-red-500/30 bg-red-500/10 text-red-300'
  if (severity === 'warning') return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
  return 'border-white/10 bg-white/[0.03] text-white/60'
}

export function highlightMatchedWords(text, words) {
  let result = String(text || '')
  for (const word of words || []) {
    const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (!escaped) continue
    result = result.replace(new RegExp(escaped, 'gi'), match => `<mark>${match}</mark>`)
  }
  return result
}
```

- [ ] **Step 4: Add TypeScript helper mirror**

Create `frontend/src/components/moderationEvidence.ts`:

```ts
export type EvidenceSeverity = 'red' | 'warning' | 'info'

export function formatEvidenceTimestamp(seconds?: number): string {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—'
  const total = Math.max(0, Math.floor(Number(seconds)))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function evidenceSeverityClass(severity: EvidenceSeverity): string {
  if (severity === 'red') return 'border-red-500/30 bg-red-500/10 text-red-300'
  if (severity === 'warning') return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
  return 'border-white/10 bg-white/[0.03] text-white/60'
}

export function highlightMatchedWords(text: string, words: string[]): string {
  let result = String(text || '')
  for (const word of words || []) {
    const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (!escaped) continue
    result = result.replace(new RegExp(escaped, 'gi'), match => `<mark>${match}</mark>`)
  }
  return result
}
```

- [ ] **Step 5: Add frontend API types and method**

In `frontend/src/api/ai.ts`, add these interfaces after `AITrackAnalysis`:

```ts
export interface ModerationEvidenceFragment {
  text: string;
  start?: number;
  end?: number;
  matched_words?: string[];
  context_before?: string;
  context_after?: string;
}

export interface ModerationEvidenceItem {
  type: 'lyrics_explicit' | 'drug_reference' | 'toxicity' | 'nsfw_cover' | 'duplicate' | 'invalid_audio' | 'audio_quality' | 'general_flag';
  severity: 'red' | 'warning' | 'info';
  title: string;
  explanation: string;
  score?: number;
  count?: number;
  fragments?: ModerationEvidenceFragment[];
}

export interface ModerationEvidenceResponse {
  track_id: number;
  summary: {
    decision: 'approve' | 'pending' | 'flag' | 'unknown';
    score: number | null;
    reasons: string[];
    red_count: number;
    warning_count: number;
    info_count: number;
  };
  evidence: ModerationEvidenceItem[];
}
```

Add this method in `aiApi` after `getTrackLyrics`:

```ts
  /** Получить детальные доказательства AI-модерации. */
  getTrackModerationEvidence: (accessToken: string, trackId: number) =>
    request<ModerationEvidenceResponse>(`/ai/tracks/${trackId}/moderation-evidence`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
```

- [ ] **Step 6: Run frontend helper tests**

Run:

```bash
cd frontend
node src/components/moderationEvidence.test.mjs
```

Expected: `moderationEvidence tests passed`.

- [ ] **Step 7: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add frontend/src/api/ai.ts frontend/src/components/moderationEvidence.mjs frontend/src/components/moderationEvidence.ts frontend/src/components/moderationEvidence.test.mjs
git commit -m "feat(frontend): add moderation evidence API helpers"
```

---

## Task 4: Render detailed evidence timeline in TrackModerationModal

**Files:**
- Modify: `frontend/src/components/TrackModerationModal.tsx`
- Uses: `frontend/src/api/ai.ts`
- Uses: `frontend/src/components/moderationEvidence.ts`

- [ ] **Step 1: Import types and helpers**

In `frontend/src/components/TrackModerationModal.tsx`, update imports:

```ts
import type { ModerationEvidenceResponse, ModerationEvidenceItem, ModerationEvidenceFragment } from '../api/ai'
import { evidenceSeverityClass, formatEvidenceTimestamp, highlightMatchedWords } from './moderationEvidence'
```

- [ ] **Step 2: Add evidence state**

Near existing state:

```ts
  const [evidenceData, setEvidenceData] = useState<ModerationEvidenceResponse | null>(null)
  const [evidenceError, setEvidenceError] = useState<string | null>(null)
```

- [ ] **Step 3: Load evidence in existing effect**

In the `useEffect(() => { ... }, [track.id])`, after `aiApi.getTrackLyrics(...)`, add:

```ts
    aiApi.getTrackModerationEvidence(tokens.accessToken, track.id)
      .then(d => {
        setEvidenceData(d)
        setEvidenceError(null)
      })
      .catch(e => {
        console.error('moderation evidence failed', e)
        setEvidenceError('Детальные доказательства недоступны')
      })
```

- [ ] **Step 4: Add seek helper**

Inside the component before `return`:

```ts
  const seekToFragment = (fragment: ModerationEvidenceFragment) => {
    const a = audioRef.current
    if (!a || fragment.start == null) return
    a.currentTime = fragment.start
    a.play().catch(() => undefined)
  }
```

- [ ] **Step 5: Add evidence fragment renderer**

Inside the component before `return`:

```tsx
  const renderFragment = (fragment: ModerationEvidenceFragment, index: number) => {
    const html = highlightMatchedWords(fragment.text, fragment.matched_words || [])
    return (
      <button
        key={`${fragment.start ?? 'no-time'}-${index}`}
        type="button"
        onClick={() => seekToFragment(fragment)}
        className="w-full text-left p-2 rounded-lg bg-black/20 hover:bg-white/[0.04] border border-white/[0.05] transition"
      >
        <div className="flex items-center gap-2 text-[10px] text-white/40 mb-1">
          <span className="font-mono">{formatEvidenceTimestamp(fragment.start)}</span>
          {fragment.end != null && <span>– {formatEvidenceTimestamp(fragment.end)}</span>}
        </div>
        <div
          className="text-xs text-white/70 leading-relaxed [&_mark]:bg-red-500/40 [&_mark]:text-red-100 [&_mark]:px-1 [&_mark]:rounded"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </button>
    )
  }
```

- [ ] **Step 6: Add evidence item renderer**

Inside the component before `return`:

```tsx
  const renderEvidenceItem = (item: ModerationEvidenceItem, index: number) => (
    <div key={`${item.type}-${index}`} className={`p-3 rounded-xl border ${evidenceSeverityClass(item.severity)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{index + 1}. {item.title}</div>
          <div className="text-xs opacity-80 mt-1">{item.explanation}</div>
        </div>
        <div className="text-[10px] uppercase tracking-wide opacity-70">{item.severity}</div>
      </div>
      <div className="flex flex-wrap gap-2 mt-2 text-[10px] opacity-80">
        {item.score != null && <span>score {item.score.toFixed(2)}</span>}
        {item.count != null && <span>{item.count} совпад.</span>}
        {item.fragments?.length ? <span>{item.fragments.length} фрагм.</span> : null}
      </div>
      {item.fragments && item.fragments.length > 0 && (
        <div className="mt-3 space-y-2">
          {item.fragments.map(renderFragment)}
        </div>
      )}
    </div>
  )
```

- [ ] **Step 7: Insert evidence block in modal body**

In the body after the track meta/player section and before the current AI summary/actions, insert:

```tsx
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-sm font-semibold text-white/80">AI объяснение модерации</div>
                <div className="text-xs text-white/40">Почему трек попал на ручную проверку</div>
              </div>
              {evidenceData && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">red {evidenceData.summary.red_count}</span>
                  <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300">warn {evidenceData.summary.warning_count}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/50">info {evidenceData.summary.info_count}</span>
                </div>
              )}
            </div>

            {evidenceData && evidenceData.evidence.length > 0 ? (
              <div className="space-y-3">
                {evidenceData.evidence.map(renderEvidenceItem)}
              </div>
            ) : evidenceError ? (
              <div className="text-xs text-yellow-300/80">{evidenceError}. Используйте текущие AI-флаги и summary ниже.</div>
            ) : (
              <div className="text-xs text-white/40">Детальные доказательства не найдены.</div>
            )}
          </div>
```

- [ ] **Step 8: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 9: Manual smoke TrackModerationModal**

Run dev stack as usual, open an AI-flagged track in moderation, and verify:

- evidence block appears;
- evidence items are ordered red/warning/info;
- fragments highlight matched words;
- clicking a fragment seeks the audio player;
- if the endpoint is stopped, modal still shows old flags/summary.

- [ ] **Step 10: Commit Task 4**

```bash
git add frontend/src/components/TrackModerationModal.tsx
git commit -m "feat(admin): show moderation evidence timeline"
```

---

## Task 5: Render compact evidence preview in AIAnalysisPanel

**Files:**
- Modify: `frontend/src/components/AIAnalysisPanel.tsx`
- Uses: `frontend/src/api/ai.ts`
- Uses: `frontend/src/components/moderationEvidence.ts`

- [ ] **Step 1: Import evidence types and helper**

In `frontend/src/components/AIAnalysisPanel.tsx`, add:

```ts
import type { ModerationEvidenceResponse } from '../api/ai'
import { evidenceSeverityClass } from './moderationEvidence'
```

- [ ] **Step 2: Add evidence state**

Near existing state:

```ts
  const [evidenceData, setEvidenceData] = useState<ModerationEvidenceResponse | null>(null)
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  const [evidenceError, setEvidenceError] = useState(false)
```

- [ ] **Step 3: Load evidence lazily when panel expands**

After the existing lyrics-loading effect, add:

```ts
  useEffect(() => {
    if (!expanded || evidenceData || evidenceLoading) return
    const loadEvidence = async () => {
      const tokens = getStoredTokens()
      if (!tokens) return
      setEvidenceLoading(true)
      try {
        const data = await aiApi.getTrackModerationEvidence(tokens.accessToken, track.id)
        setEvidenceData(data)
        setEvidenceError(false)
      } catch (e) {
        console.error('Failed to load moderation evidence', e)
        setEvidenceError(true)
      } finally {
        setEvidenceLoading(false)
      }
    }
    loadEvidence()
  }, [expanded, evidenceData, evidenceLoading, track.id])
```

- [ ] **Step 4: Add compact preview below flags**

Inside expanded content, after the existing flags block and before mood/genre tags, insert:

```tsx
          {(evidenceData || evidenceLoading || evidenceError) && (
            <div>
              <div className="text-white/40 uppercase tracking-wide mb-1.5 text-[10px]">Почему на модерации</div>
              {evidenceLoading && <div className="text-white/40">Загружаю доказательства...</div>}
              {evidenceError && <div className="text-yellow-300/70">Детальные доказательства недоступны</div>}
              {evidenceData && evidenceData.evidence.length > 0 && (
                <div className="space-y-1.5">
                  {evidenceData.evidence.slice(0, 3).map((item, index) => (
                    <div key={`${item.type}-${index}`} className={`p-2 rounded-lg border ${evidenceSeverityClass(item.severity)}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{item.title}</span>
                        <span className="text-[10px] opacity-70">{item.severity}</span>
                      </div>
                      <div className="text-[11px] opacity-80 mt-0.5">
                        {item.fragments?.length ? `${item.fragments.length} фрагм.` : item.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {evidenceData && evidenceData.evidence.length === 0 && (
                <div className="text-white/40">Детальные причины не найдены</div>
              )}
            </div>
          )}
```

- [ ] **Step 5: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 6: Manual smoke AIAnalysisPanel**

Open a page containing `AIAnalysisPanel`, expand it, and verify:

- compact evidence loads;
- top 3 reasons render;
- old flags/lyrics/audio feature sections still render;
- endpoint failure shows compact fallback.

- [ ] **Step 7: Commit Task 5**

```bash
git add frontend/src/components/AIAnalysisPanel.tsx
git commit -m "feat(ui): preview moderation evidence in ai panel"
```

---

## Task 6: Final verification and integration check

**Files:**
- Verify all files changed in Tasks 1-5.

- [ ] **Step 1: Run ai-service tests**

Run:

```bash
cd ai-service
.venv/Scripts/python.exe -m pytest tests -q
```

Expected: PASS.

- [ ] **Step 2: Run frontend helper tests**

Run:

```bash
cd frontend
node src/components/moderationEvidence.test.mjs
```

Expected:

```text
moderationEvidence tests passed
```

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run manual API smoke through ai-service if a track analysis exists**

Run with a known analyzed track id:

```bash
cd ai-service
.venv/Scripts/python.exe - <<'PY'
from app.api.analysis_router import get_track_moderation_evidence
print(get_track_moderation_evidence(1))
PY
```

Expected: either a JSON-like dict for track `1` or a 404 exception if track `1` has no analysis. If 404 occurs, repeat with an analyzed track id from the local database.

- [ ] **Step 5: Review changed files**

Run:

```bash
git diff -- ai-service/app/analysis/moderation_evidence.py ai-service/app/api/analysis_router.py ai-service/tests/test_moderation_evidence.py backend/routes/ai.ts frontend/src/api/ai.ts frontend/src/components/moderationEvidence.ts frontend/src/components/moderationEvidence.mjs frontend/src/components/moderationEvidence.test.mjs frontend/src/components/TrackModerationModal.tsx frontend/src/components/AIAnalysisPanel.tsx
```

Expected: changes match this plan, with no unrelated refactors.

- [ ] **Step 6: Commit final verification adjustments if any**

If Step 5 reveals small fixes, apply them with TDD where behavior changes, rerun Steps 1-3, then commit:

```bash
git add <fixed-files>
git commit -m "fix: polish moderation evidence integration"
```

If there are no fixes, no commit is needed for this task.
