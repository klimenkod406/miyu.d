# AI Moderation Evidence Design

## Goal

Improve the administrator moderation experience by explaining why a track was moved to manual review. The UI should show a readable evidence trail: summary reasons, exact lyrics fragments when available, and non-text signals such as NSFW cover, duplicate risk, invalid audio, and general AI score.

The first iteration should be deterministic and based on existing analysis outputs. It should not use an LLM and should not require a database schema change.

## Current context

Existing analysis already stores the main signals in `track_analysis`:

- `ai_score`
- `ai_flags`
- `lyrics_text`
- `lyrics_language`
- `segments_json`
- `analysis_summary`
- audio features, genre tags, mood tags, fingerprint

Existing UI already shows AI score, flags, analysis summary, lyrics, and explicit words in:

- `frontend/src/components/TrackModerationModal.tsx`
- `frontend/src/components/AIAnalysisPanel.tsx`

Existing API already exposes lyrics and explicit stats through:

- `GET /analysis/track/{track_id}/lyrics`

## Chosen UX approach

Use the **evidence timeline** layout.

In `TrackModerationModal`, show a detailed ordered list of reasons. Each reason contains:

1. title and severity;
2. short explanation;
3. score/count metadata where relevant;
4. lyrics fragments with context and timestamps when available;
5. click-to-seek behavior for timestamped fragments.

In `AIAnalysisPanel`, show a compact version:

- score and status;
- top reasons;
- count of evidence items/fragments;
- small preview of the first few reasons;
- fallback to current flags/summary if detailed evidence cannot be loaded.

## API design

Add a new AI-service endpoint:

```text
GET /analysis/track/{track_id}/moderation-evidence
```

Response shape:

```ts
type ModerationEvidenceResponse = {
  track_id: number
  summary: {
    decision: 'approve' | 'pending' | 'flag' | 'unknown'
    score: number | null
    reasons: string[]
    red_count: number
    warning_count: number
    info_count: number
  }
  evidence: ModerationEvidenceItem[]
}

type ModerationEvidenceItem = {
  type:
    | 'lyrics_explicit'
    | 'drug_reference'
    | 'toxicity'
    | 'nsfw_cover'
    | 'duplicate'
    | 'invalid_audio'
    | 'audio_quality'
    | 'general_flag'
  severity: 'red' | 'warning' | 'info'
  title: string
  explanation: string
  score?: number
  count?: number
  fragments?: ModerationEvidenceFragment[]
}

type ModerationEvidenceFragment = {
  text: string
  start?: number
  end?: number
  matched_words?: string[]
  context_before?: string
  context_after?: string
}
```

## Backend design

Create a focused builder module:

```text
ai-service/app/analysis/moderation_evidence.py
```

Responsibilities:

- read normalized inputs from `track_analysis`;
- call `text_moderation.analyze_explicit(lyrics_text)` for explicit/drug/slur matches;
- connect text matches to `segments_json` when possible;
- create evidence items from `ai_flags` for non-text signals;
- sort evidence by severity and type priority;
- return a stable JSON-compatible structure.

The builder should not call heavy ML models. It only uses saved analysis results and deterministic regex/dictionary analysis.

`summary.decision` should be derived deterministically from saved values: if red evidence exists, return `flag`; otherwise if `ai_score` is at or above the configured flag threshold, return `flag`; otherwise if any warning evidence exists, return `pending`; otherwise return `approve`. If no analysis row exists, the endpoint returns `404` rather than `unknown`; `unknown` is reserved for malformed legacy rows.

### Text evidence

For explicit/drug/slur matches:

- group matches by category;
- create one evidence item per category;
- include up to 5 fragments per item in the first iteration, enough for the moderator to inspect quickly without overwhelming the modal;
- each fragment should include the matched word and surrounding context from the lyrics;
- if a segment timestamp contains the matched text, include `start` and `end` so the UI can seek audio.

### Non-text evidence

For `ai_flags`:

- `invalid_audio` → red evidence item without fragments;
- `possible_duplicate` → red or warning item depending on available duplicate score;
- `nsfw_cover` → red item;
- `suggestive_cover` → warning item;
- unknown flags → `general_flag` item with info/warning severity.

If the underlying score is not available in the current data, the item should still explain the flag using the flag name and current `ai_score`.

## Frontend design

### TrackModerationModal

Add a new evidence block after track metadata/player and before the approve/reject controls.

The block should show:

- summary row: AI score, decision/status, number of red/warning/info items;
- timeline list of evidence items;
- fragments under each item;
- highlighted matched words in fragments;
- click on a timestamped fragment seeks the existing audio player to `fragment.start`.

If the evidence endpoint fails:

- keep the modal usable;
- show current `ai_flags` and `analysis_summary`;
- display a small message: “Детальные доказательства недоступны”.

### AIAnalysisPanel

Add compact evidence preview when expanded:

- load the same endpoint lazily;
- show top 3 evidence items;
- show fragment counts instead of full context;
- preserve existing lyrics toggle and current AI score display.

## Error handling

- Missing analysis row: endpoint returns `404`.
- Missing lyrics: endpoint returns non-text evidence only.
- Missing segments: text fragments still show context, but no timestamps.
- Unknown flags: keep them visible as `general_flag` rather than dropping them.
- Endpoint failure in frontend: fallback to existing flags/summary UI.

## Testing plan

### AI-service

Add tests for the evidence builder:

- explicit lyrics create `lyrics_explicit` evidence with fragments;
- drug references create `drug_reference` evidence;
- slur matches use `red` severity;
- `possible_duplicate`, `invalid_audio`, and `nsfw_cover` create non-text evidence;
- clean analysis returns an empty evidence list or only low-priority info items;
- fragment matching works without `segments_json` and with `segments_json`.

### Frontend

If no frontend test runner is configured, keep frontend logic small and testable through pure helpers where possible:

- map evidence severity to UI classes;
- highlight matched words in fragment text;
- format timestamps.

Manual smoke checks:

- open moderation modal for an AI-flagged track;
- confirm evidence timeline renders;
- click a timestamped fragment and confirm audio seeks;
- expand `AIAnalysisPanel` and confirm compact preview renders;
- confirm fallback still works if the evidence request fails.

## Out of scope for first iteration

- LLM-generated explanations;
- storing evidence JSON in the database;
- changing moderation decision logic;
- new moderation categories beyond current flags and explicit/drug/slur dictionaries;
- batch evidence generation for all tracks.

## Success criteria

The implementation is successful when an admin can open a flagged track and answer these questions without reading raw JSON:

1. Why did AI send this track to moderation?
2. Which exact text fragments are suspicious?
3. Are there non-text reasons such as NSFW cover, duplicate, or invalid audio?
4. How severe is each reason?
5. Where in the audio should the admin listen to verify a text fragment?
