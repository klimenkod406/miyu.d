# Predeploy Polish, Genre Search and Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the seven requested pre-deploy improvements, keep the existing upload fixes intact, verify locally, then deploy.

**Architecture:** Use focused edits in existing frontend, backend and AI-service files. Avoid a large visualizer architecture rewrite; instead, add targeted helpers/tests and improve the specific components named in the request.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind, Framer Motion, Express/TypeScript, SQLite, Python/FastAPI AI service, pytest, Node test runner.

---

## File Structure

### Frontend

- Modify `frontend/src/pages/TrackPage.tsx`
  - Restyle lyrics drawer into a top-center toast-like animated popup using existing `framer-motion` dependency.
- Modify `frontend/src/pages/HomePage.tsx`
  - Stop music-bar animation when the current track is paused.
- Modify `frontend/src/components/MiniPlayer.tsx`
  - Add white translucent fallback progress fill when there is no cover art.
- Modify `frontend/src/pages/GenresPage.tsx`
  - Change genre card navigation from `/search?q=<genre>` to `/search?genre=<genre>`.
- Modify `frontend/src/api/search.ts`
  - Add optional `genre` parameter to search API client.
  - Include `genre` in track result type.
- Modify `frontend/src/pages/SearchPage.tsx`
  - Read `genre` search param.
  - Show genre result heading/chip.
  - Call search API with genre filter.
- Modify `frontend/src/lib/visualizerPalettes.ts`
  - Add missing aliases for AI-normalized labels.
- Modify `frontend/src/components/MiniAudioVisualizer.tsx`
  - Bring response logic closer to `AudioVisualizer`: mid/treble bands, beat envelope, smoother idle and active reaction.

### Backend

- Modify `backend/routes/search.ts`
  - Add `genre` query parameter.
  - Return genre-filtered tracks when `genre` is present, including `genre` in track payload.
  - Keep existing text search unchanged.

### AI service

- Modify `ai-service/app/analysis/repository.py`
  - Add helper to select the strongest valid primary genre tag.
  - Export or keep helper private; tests may import private helper if needed.
- Modify `ai-service/tests/test_repository_track_sync.py`
  - Add tests for selecting strongest valid genre and assigning genres to multiple empty tracks while preserving manual genres.

### Existing upload fixes to keep verified

- `backend/routes/admin-upload.ts`
- `backend/routes/admin-upload.test.ts`
- `frontend/src/pages/AdminBatchUploadPage.tsx`
- `frontend/src/lib/batchUpload.ts`

---

## Task 1: AI genre selection and persistence

**Files:**
- Modify: `ai-service/app/analysis/repository.py`
- Modify: `ai-service/tests/test_repository_track_sync.py`

- [ ] **Step 1: Add failing tests for robust primary genre selection**

Append these tests to `ai-service/tests/test_repository_track_sync.py`:

```python
def test_select_primary_genre_uses_highest_valid_normalized_tag():
    genre_tags = [
        {"tag": "speech", "prob": 0.99},
        {"tag": "electronic", "prob": 0.41},
        {"tag": "rock", "prob": 0.73},
    ]

    assert repository._select_primary_genre(genre_tags) == "Рок"


def test_select_primary_genre_supports_ai_normalized_labels():
    assert repository._select_primary_genre([{"tag": "lo-fi", "prob": 0.44}]) == "Lo-fi"
    assert repository._select_primary_genre([{"tag": "soul music", "prob": 0.44}]) == "Соул"
    assert repository._select_primary_genre([{"tag": "ambient music", "prob": 0.44}]) == "Эмбиент"
```

- [ ] **Step 2: Run tests and verify they fail before implementation**

Run:

```bash
cd ai-service
python -m pytest tests/test_repository_track_sync.py -q
```

Expected: FAIL with `AttributeError: module 'app.analysis.repository' has no attribute '_select_primary_genre'`.

- [ ] **Step 3: Implement genre helper**

In `ai-service/app/analysis/repository.py`, after `_normalize_genre_label`, add:

```python
def _genre_probability(item: dict[str, Any]) -> float:
    value = item.get("prob", 0)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _select_primary_genre(genre_tags: list[dict]) -> str | None:
    candidates: list[tuple[float, str]] = []
    for item in genre_tags:
        if not isinstance(item, dict):
            continue
        label = _normalize_genre_label(item.get("tag"))
        if not label:
            continue
        candidates.append((_genre_probability(item), label))

    if not candidates:
        return None

    candidates.sort(key=lambda entry: entry[0], reverse=True)
    return candidates[0][1]
```

Then replace this block in `upsert_track_analysis`:

```python
    primary_genre = None
    if genre_tags:
        top_genre = genre_tags[0]
        if isinstance(top_genre, dict):
            primary_genre = _normalize_genre_label(top_genre.get("tag"))
```

with:

```python
    primary_genre = _select_primary_genre(genre_tags)
```

- [ ] **Step 4: Add multi-track persistence regression test**

Append this test to `ai-service/tests/test_repository_track_sync.py`:

```python
def test_upsert_track_analysis_assigns_genres_to_multiple_empty_tracks(tmp_path, monkeypatch):
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
```

- [ ] **Step 5: Run AI tests**

Run:

```bash
cd ai-service
python -m pytest tests/test_repository_track_sync.py -q
```

Expected: all tests in this file pass.

- [ ] **Step 6: Commit AI genre fix**

Run:

```bash
git add ai-service/app/analysis/repository.py ai-service/tests/test_repository_track_sync.py
git commit -m "fix: stabilize AI genre assignment"
```

---

## Task 2: Backend genre search

**Files:**
- Modify: `backend/routes/search.ts`

- [ ] **Step 1: Add helper functions to `backend/routes/search.ts`**

After `const router = Router();`, add:

```ts
function normalizeMediaPath(value: string | null, prefix: '/uploads/tracks/' | '/uploads/albums/' | '/uploads/avatars/' | '/uploads/concerts/' | '/uploads/playlists/'): string | null {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('/uploads/') || value.startsWith('data:image/')) return value;
  return `${prefix}${value}`;
}

function mapTrackRow(track: any) {
  const coverUrl = normalizeMediaPath(track.cover_url, '/uploads/tracks/');
  const albumCoverUrl = normalizeMediaPath(track.album_cover, '/uploads/albums/');
  return {
    id: track.id,
    title: track.title,
    duration: track.duration,
    file_path: track.file_path,
    cover_url: coverUrl,
    genre: track.genre,
    is_explicit: track.is_explicit,
    is_premium: track.is_premium,
    artist: {
      id: track.artist_id,
      username: track.artist_name,
      is_verified: track.artist_verified,
      is_premium: track.artist_premium
    },
    album: track.album_id ? {
      id: track.album_id,
      title: track.album_title,
      cover_url: albumCoverUrl
    } : null
  };
}
```

- [ ] **Step 2: Read genre query param**

In the route handler, replace:

```ts
    const query = String(req.query.q || '').trim();
    const type = req.query.type as string | undefined;
```

with:

```ts
    const query = String(req.query.q || '').trim();
    const genre = String(req.query.genre || '').trim();
    const type = req.query.type as string | undefined;
```

- [ ] **Step 3: Add genre-filter branch before the empty-query branch**

Immediately before the comment `// If no query, return popular/recent content (limited)`, add:

```ts
    if (genre) {
      const results: any = {
        tracks: [],
        artists: [],
        albums: [],
        playlists: [],
        concerts: []
      };

      if (!type || type === 'tracks' || type === 'all') {
        const tracks = await getAll<any>(
          `SELECT
            t.id, t.title, t.duration, t.file_path, t.cover_url, t.genre, t.is_explicit, t.is_premium,
            u.id as artist_id, u.username as artist_name, u.is_verified as artist_verified, u.is_premium as artist_premium,
            a.id as album_id, a.title as album_title, a.cover_url as album_cover
           FROM tracks t
           JOIN users u ON t.artist_id = u.id
           LEFT JOIN albums a ON t.album_id = a.id
           WHERE t.status = 'approved' AND LOWER(TRIM(t.genre)) = LOWER(TRIM(?))
           ORDER BY t.created_at DESC
           LIMIT 50`,
          [genre]
        );
        results.tracks = tracks.map(mapTrackRow);
      }

      return res.json(results);
    }
```

- [ ] **Step 4: Include genre in existing track SQL queries**

In the empty-query popular track SQL, change:

```sql
          t.id, t.title, t.duration, t.file_path, t.cover_url, t.is_explicit, t.is_premium,
```

to:

```sql
          t.id, t.title, t.duration, t.file_path, t.cover_url, t.genre, t.is_explicit, t.is_premium,
```

In the text-search track SQL, change:

```sql
          t.id, t.title, t.duration, t.file_path, t.cover_url, t.is_explicit, t.is_premium,
```

to:

```sql
          t.id, t.title, t.duration, t.file_path, t.cover_url, t.genre, t.is_explicit, t.is_premium,
```

- [ ] **Step 5: Replace duplicated track mapping with helper**

In both existing track mapping sections, replace the manual mapping body with:

```ts
      results.tracks = tracks.map(mapTrackRow);
```

- [ ] **Step 6: Build backend**

Run:

```bash
npm --prefix backend run build
```

Expected: TypeScript build passes.

- [ ] **Step 7: Commit backend genre search**

Run:

```bash
git add backend/routes/search.ts
git commit -m "feat: add genre-filtered search"
```

---

## Task 3: Frontend genre search wiring

**Files:**
- Modify: `frontend/src/api/search.ts`
- Modify: `frontend/src/pages/SearchPage.tsx`
- Modify: `frontend/src/pages/GenresPage.tsx`

- [ ] **Step 1: Update search API types and method**

In `frontend/src/api/search.ts`, add `genre` to the track type:

```ts
    genre: string | null;
```

Place it after `cover_url: string | null;`.

Replace the `search` method with:

```ts
  search: async (
    accessToken: string,
    query: string,
    type?: 'all' | 'tracks' | 'artists' | 'albums' | 'playlists' | 'concerts',
    genre?: string,
  ): Promise<SearchResults> => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (genre) params.set('genre', genre);
    if (type && type !== 'all') {
      params.append('type', type);
    }
    return request<SearchResults>(`/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
```

- [ ] **Step 2: Update `SearchPage` to read genre param**

In `frontend/src/pages/SearchPage.tsx`, after:

```ts
  const query = searchParams.get('q') || ''
```

add:

```ts
  const genre = searchParams.get('genre') || ''
```

- [ ] **Step 3: Use genre in API call and effect dependencies**

Replace:

```ts
        const data = await searchApi.search(accessToken, query, activeTab)
```

with:

```ts
        const data = await searchApi.search(accessToken, query, activeTab, genre)
```

Replace the effect dependency array:

```ts
  }, [query, activeTab, accessToken])
```

with:

```ts
  }, [query, genre, activeTab, accessToken])
```

- [ ] **Step 4: Update SearchPage title and genre chip**

Replace the `<h1>` block:

```tsx
      <h1 className="mb-6 text-2xl font-bold max-[414px]:mb-4 max-[414px]:text-xl">
        {query ? `Результаты поиска: "${query}"` : 'Поиск'}
      </h1>
```

with:

```tsx
      <div className="mb-6 max-[414px]:mb-4">
        <h1 className="text-2xl font-bold max-[414px]:text-xl">
          {genre ? `Жанр: ${genre}` : query ? `Результаты поиска: "${query}"` : 'Поиск'}
        </h1>
        {genre && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm text-white/70">
            Треки с жанром
            <span className="font-semibold text-white">{genre}</span>
          </div>
        )}
      </div>
```

- [ ] **Step 5: Show track genres in SearchPage results**

Replace:

```tsx
                            <p className="text-sm text-white/40 truncate">{track.artist.username}</p>
```

with:

```tsx
                            <p className="text-sm text-white/40 truncate">
                              {track.artist.username}{track.genre ? ` • ${track.genre}` : ''}
                            </p>
```

- [ ] **Step 6: Keep tabs visible for genre searches**

Replace:

```tsx
      {query && hasAnyResults && (
```

with:

```tsx
      {(query || genre) && hasAnyResults && (
```

- [ ] **Step 7: Update genre navigation URL**

In `frontend/src/pages/GenresPage.tsx`, replace:

```ts
    navigate(`/search?q=${encodeURIComponent(genre)}`)
```

with:

```ts
    navigate(`/search?genre=${encodeURIComponent(genre)}`)
```

- [ ] **Step 8: Build frontend**

Run:

```bash
npm --prefix frontend run build
```

Expected: frontend build passes. Existing Vite warnings about chunk size may remain.

- [ ] **Step 9: Commit frontend genre search**

Run:

```bash
git add frontend/src/api/search.ts frontend/src/pages/SearchPage.tsx frontend/src/pages/GenresPage.tsx
git commit -m "feat: wire genre search UI"
```

---

## Task 4: Track lyrics popup restyle

**Files:**
- Modify: `frontend/src/pages/TrackPage.tsx`

- [ ] **Step 1: Add motion imports**

In `frontend/src/pages/TrackPage.tsx`, add:

```ts
import { AnimatePresence, motion } from 'framer-motion'
```

below the existing imports.

- [ ] **Step 2: Replace lyrics backdrop and drawer block**

Remove the existing backdrop block:

```tsx
      {track.lyrics && showLyrics && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowLyrics(false)} />
      )}
```

Remove the existing drawer block near the end:

```tsx
      {track.lyrics && (
        <div 
          className={`fixed top-4 right-4 h-[calc(100%-2rem)] w-full md:w-96 bg-dark-900/95 backdrop-blur-md border border-white/[0.05] shadow-2xl rounded-2xl z-50 transition-all duration-300 ${
            showLyrics ? 'opacity-100 visible translate-x-0' : 'opacity-0 invisible translate-x-8'
          }`}
        >
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4">
              <h3 className="text-lg font-medium">Текст песни</h3>
              <button 
                onClick={() => setShowLyrics(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-white/60 font-mono text-sm leading-relaxed">
                {track.lyrics}
              </pre>
            </div>
          </div>
        </div>
      )}
```

Insert this block before the closing `</div>` of the page:

```tsx
      <AnimatePresence>
        {track.lyrics && showLyrics && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLyrics(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -56, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -36, scale: 0.97 }}
              transition={{ type: 'spring', damping: 26, stiffness: 360 }}
              className="fixed left-1/2 top-5 z-50 w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-[1.75rem] border border-white/12 bg-black/80 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(168,85,247,0.18),rgba(59,130,246,0.08),transparent_70%)]" />
              <div className="relative flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/35">lyrics</p>
                  <h3 className="truncate text-lg font-semibold text-white">Текст песни</h3>
                </div>
                <button
                  onClick={() => setShowLyrics(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/70 transition hover:bg-white/14 hover:text-white"
                  aria-label="Закрыть текст песни"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="relative max-h-[min(70vh,34rem)] overflow-y-auto px-5 py-4">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-white/72">
                  {track.lyrics}
                </pre>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
```

- [ ] **Step 3: Build frontend**

Run:

```bash
npm --prefix frontend run build
```

Expected: frontend build passes.

- [ ] **Step 4: Commit lyrics popup restyle**

Run:

```bash
git add frontend/src/pages/TrackPage.tsx
git commit -m "style: restyle track lyrics popup"
```

---

## Task 5: Home track-card paused animation and mini-player fallback progress

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx`
- Modify: `frontend/src/components/MiniPlayer.tsx`

- [ ] **Step 1: Stop non-playing overlay bars on HomePage**

In `frontend/src/pages/HomePage.tsx`, replace:

```tsx
        {isCurrentTrack && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="flex items-end gap-0.5 h-8">
              <div className="w-1 bg-white rounded-full animate-music-bar-1"></div>
              <div className="w-1 bg-white rounded-full mx-0.5 animate-music-bar-2"></div>
              <div className="w-1 bg-white rounded-full animate-music-bar-3"></div>
            </div>
          </div>
        )}
```

with:

```tsx
        {isPlaying && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="flex items-end gap-0.5 h-8">
              <div className="w-1 bg-white rounded-full animate-music-bar-1"></div>
              <div className="w-1 bg-white rounded-full mx-0.5 animate-music-bar-2"></div>
              <div className="w-1 bg-white rounded-full animate-music-bar-3"></div>
            </div>
          </div>
        )}
```

- [ ] **Step 2: Add fallback progress fill to MiniPlayer**

In `frontend/src/components/MiniPlayer.tsx`, after the closing `</AnimatePresence>` that renders the cover blur progress, insert:

```tsx
      {!coverUrl && progressPercent > 0 && (
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-white/18 via-white/10 to-white/0"
          initial={false}
          animate={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          transition={{ duration: 0.25, ease: 'linear' }}
        />
      )}
```

- [ ] **Step 3: Build frontend**

Run:

```bash
npm --prefix frontend run build
```

Expected: frontend build passes.

- [ ] **Step 4: Commit playback UI fixes**

Run:

```bash
git add frontend/src/pages/HomePage.tsx frontend/src/components/MiniPlayer.tsx
git commit -m "fix: pause track-card bars and show fallback progress"
```

---

## Task 6: Visualizer palette aliases

**Files:**
- Modify: `frontend/src/lib/visualizerPalettes.ts`

- [ ] **Step 1: Extend genre alias checks**

In `paletteForGenre`, replace these lines:

```ts
  if (k.includes('r&b') || k.includes('rnb') || k.includes('соул') || k.includes('soul')) return PALETTES.rnb
  if (k.includes('джаз') || k.includes('jazz')) return PALETTES.jazz
  if (k.includes('блюз') || k.includes('blues')) return PALETTES.blues
  if (k.includes('класс') || k.includes('class')) return PALETTES.classical
  if (k.includes('эмбиент') || k.includes('ambient') || k.includes('chill')) return PALETTES.ambient
```

with:

```ts
  if (k.includes('r&b') || k.includes('rnb') || k.includes('соул') || k.includes('soul')) return PALETTES.rnb
  if (k.includes('lo-fi') || k.includes('lofi') || k.includes('лоу')) return PALETTES.ambient
  if (k.includes('джаз') || k.includes('jazz')) return PALETTES.jazz
  if (k.includes('блюз') || k.includes('blues')) return PALETTES.blues
  if (k.includes('класс') || k.includes('class')) return PALETTES.classical
  if (k.includes('эмбиент') || k.includes('ambient') || k.includes('chill')) return PALETTES.ambient
```

Also replace:

```ts
  if (k.includes('панк') || k.includes('punk')) return PALETTES.punk
```

with:

```ts
  if (k.includes('панк') || k.includes('punk')) return PALETTES.punk
```

This second replacement is intentionally idempotent: verify that `Панк-рок` is covered because `панк` matches.

- [ ] **Step 2: Build frontend**

Run:

```bash
npm --prefix frontend run build
```

Expected: frontend build passes.

- [ ] **Step 3: Commit palette aliases**

Run:

```bash
git add frontend/src/lib/visualizerPalettes.ts
git commit -m "fix: extend visualizer genre palettes"
```

---

## Task 7: Mini visualizer response parity

**Files:**
- Modify: `frontend/src/components/MiniAudioVisualizer.tsx`

- [ ] **Step 1: Add clamp helper**

After `function lerp(a: number, b: number, t: number) { ... }`, add:

```ts
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
```

- [ ] **Step 2: Add missing signal state**

Inside the canvas effect, replace:

```ts
    let smoothBass = 0
    let smoothVocal = 0
    let smoothPresence = 0
    let activityEnvelope = 0
```

with:

```ts
    let smoothBass = 0
    let smoothMid = 0
    let smoothTreble = 0
    let smoothVocal = 0
    let smoothPresence = 0
    let activityEnvelope = 0
    let bassAvg = 0
    let lastBeatT = 0
    const ringBeatEnv = new Float32Array(RING_COUNT)
```

- [ ] **Step 3: Read mid and treble bands**

Inside `tick`, replace:

```ts
      let bass = 0
      let vocal = 0
      let presence = 0
      let total = 0
```

with:

```ts
      let bass = 0
      let mid = 0
      let treble = 0
      let vocal = 0
      let presence = 0
      let total = 0
```

Inside `if (analyser)`, after bass calculation, insert:

```ts
        s = 0
        for (let i = 16; i < 64; i++) s += freqData[i]
        mid = s / ((64 - 16) * 255)
        s = 0
        for (let i = 64; i < freqData.length; i++) s += freqData[i]
        treble = s / ((freqData.length - 64) * 255)
```

Replace:

```ts
        total = sum / (freqData.length * 255)
```

with:

```ts
        total = (bass + mid + treble) / 3
```

- [ ] **Step 4: Match large visualizer envelope and idle behavior**

Replace:

```ts
      const idle = !isPlayingRef.current || total < 0.005
      const envelopeTarget = idle ? 0 : Math.max(0, Math.min(1, total * 3 + bass * 1.1 + vocal * 0.9))
      activityEnvelope = lerp(
        activityEnvelope,
        envelopeTarget,
        envelopeTarget > activityEnvelope ? 0.07 : 0.038,
      )
      const easedEnvelope = activityEnvelope * activityEnvelope * (3 - 2 * activityEnvelope)
      const activeResponse = Math.max(0, Math.min(1, easedEnvelope))

      if (!idle) {
        bass *= activeResponse
        vocal *= activeResponse
        presence *= activeResponse
      }

      smoothBass = lerp(smoothBass, bass, 0.06 + 0.12 * activeResponse)
      smoothVocal = lerp(smoothVocal, vocal, 0.07 + 0.15 * activeResponse)
      smoothPresence = lerp(smoothPresence, presence, 0.06 + 0.10 * activeResponse)
```

with:

```ts
      const idle = !isPlayingRef.current || total < 0.005
      const envelopeTarget = idle ? 0 : clamp(total * 2.8 + bass * 1.2 + vocal * 0.9, 0, 1)
      activityEnvelope = lerp(
        activityEnvelope,
        envelopeTarget,
        envelopeTarget > activityEnvelope ? 0.055 : 0.03,
      )
      const easedEnvelope = activityEnvelope * activityEnvelope * (3 - 2 * activityEnvelope)
      const activeResponse = clamp(easedEnvelope, 0, 1)

      if (idle) {
        const breathe = (Math.sin(t * 0.012) + 1) / 2
        bass = 0.015 + breathe * 0.015
        mid = 0.015 + breathe * 0.012
        treble = 0.01 + breathe * 0.01
        vocal = 0.012 + breathe * 0.014
        presence = 0.01 + breathe * 0.012
      } else {
        bass *= activeResponse
        mid *= activeResponse
        treble *= activeResponse
        vocal *= activeResponse
        presence *= activeResponse
      }

      bassAvg = bassAvg * 0.96 + bass * 0.04
      const isBeat = !idle && easedEnvelope > 0.18 && bass > bassAvg * 1.45 && bass > 0.22 && t - lastBeatT > 10
      if (isBeat) {
        lastBeatT = t
        for (let i = 0; i < RING_COUNT; i++) ringBeatEnv[i] = easedEnvelope
      }
      for (let i = 0; i < RING_COUNT; i++) ringBeatEnv[i] *= 0.9

      smoothBass = lerp(smoothBass, bass, 0.06 + 0.12 * activeResponse)
      smoothMid = lerp(smoothMid, mid, 0.06 + 0.1 * activeResponse)
      smoothTreble = lerp(smoothTreble, treble, 0.05 + 0.08 * activeResponse)
      smoothVocal = lerp(smoothVocal, vocal, 0.07 + 0.15 * activeResponse)
      smoothPresence = lerp(smoothPresence, presence, 0.06 + 0.10 * activeResponse)
```

- [ ] **Step 5: Add beat pulse to ring drawing**

Inside ring loop, after:

```ts
        const vocalBias = Math.min(1, boostedVoice * 0.72 + boostedBand * 0.28)
```

add:

```ts
        const beatPulse = ringBeatEnv[i] * (1 - i / (RING_COUNT * 1.4))
```

Replace:

```ts
        const grow = 1 + growSwing * (0.5 + 0.5 * growWobble)
        const jitter = (smoothPresence * 0.65 + smoothBass * 0.35) * Math.sin(t * 0.3 + cfg.breathPhase) * 0.015
```

with:

```ts
        const grow = 1 + growSwing * (0.5 + 0.5 * growWobble) + beatPulse * 0.16
        const jitter = (smoothPresence * 0.55 + smoothBass * 0.3 + smoothMid * 0.15) * Math.sin(t * 0.3 + cfg.breathPhase) * 0.015
```

Replace:

```ts
        ctx.lineWidth = 1 + boostedVoice * 0.55 + boostedBand * 0.18
```

with:

```ts
        ctx.lineWidth = 1 + boostedVoice * 0.55 + boostedBand * 0.18 + beatPulse * 0.7 + smoothTreble * 0.15
```

- [ ] **Step 6: Build frontend**

Run:

```bash
npm --prefix frontend run build
```

Expected: frontend build passes.

- [ ] **Step 7: Commit mini visualizer update**

Run:

```bash
git add frontend/src/components/MiniAudioVisualizer.tsx
git commit -m "feat: improve mini visualizer music response"
```

---

## Task 8: Full verification before deployment

**Files:**
- No new edits unless verification reveals a bug.

- [ ] **Step 1: Run backend upload/search build verification**

Run:

```bash
npm --prefix backend run build && node --test backend/dist/routes/admin-upload.test.js backend/dist/services/trackImportService.test.js
```

Expected: build passes and all listed Node tests pass.

- [ ] **Step 2: Run AI service regression tests**

Run:

```bash
cd ai-service
python -m pytest tests/test_repository_track_sync.py tests/test_text_moderation_config.py -q
```

Expected: all selected pytest tests pass.

- [ ] **Step 3: Run frontend build**

Run:

```bash
npm --prefix frontend run build
```

Expected: frontend build passes. Existing Vite chunk-size warnings are acceptable.

- [ ] **Step 4: Manual smoke checklist**

Use the browser or local dev server if available and check:

```text
[ ] Track page lyrics opens top-center and closes upward.
[ ] Home current-track bars animate only while actually playing.
[ ] Home current-track paused state does not animate bars.
[ ] Mini-player without cover shows white translucent progress.
[ ] /genres card opens /search?genre=<genre>.
[ ] /search?genre=<genre> shows only tracks for that genre.
[ ] Big visualizer changes palette for AI genres such as Соул, Lo-fi, Эмбиент, Панк-рок.
[ ] Mini visualizer responds to bass/voice/beat while playing and idles while paused.
[ ] Admin batch upload regression still handles Cyrillic filename manifest mismatch fix.
```

- [ ] **Step 5: Commit verification-only fixes if needed**

If verification found and fixed an issue, commit only the relevant files:

```bash
git add <fixed-files>
git commit -m "fix: address predeploy verification issues"
```

If no fixes were needed, do not create an empty commit.

---

## Task 9: Deploy after verification

**Files:**
- Server files under `/opt/miyu` via archive/SFTP or existing deployment approach.

- [ ] **Step 1: Confirm local working tree contains only intended changes**

Run:

```bash
git status --short
```

Expected intended code/docs changes only. Do not deploy unrelated runtime artifacts such as `database/miyu.db`, `.openclaude-*`, `.playwright-mcp/`, `.superpowers/`, or temporary worktrees.

- [ ] **Step 2: Transfer changed code to VPS**

Use the same deployment method already used for this project. Target:

```text
root@130.49.149.252:/opt/miyu
```

Transfer changed source files and lockfiles only if lockfiles changed.

- [ ] **Step 3: Rebuild/recreate services**

On VPS:

```bash
cd /opt/miyu
docker compose --env-file .env.production -f docker-compose.prod.yml build backend frontend ai-service ai-worker
docker compose --env-file .env.production -f docker-compose.prod.yml up -d backend frontend ai-service ai-worker nginx
```

- [ ] **Step 4: Check service health**

On VPS:

```bash
cd /opt/miyu
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS http://127.0.0.1:8001/health
```

Public check from local machine:

```bash
curl -I http://130.49.149.252/
curl -fsS http://130.49.149.252/api/health
```

Expected: services are up, public site returns HTTP 200/OK, backend health OK, AI health OK.

- [ ] **Step 5: Server smoke checklist**

Check on the live site:

```text
[ ] http://130.49.149.252/ loads.
[ ] /admin/upload accepts Cyrillic MP3 names without manifest mismatch.
[ ] /track/<id> lyrics popup uses top animated style.
[ ] /genres opens genre search.
[ ] /search?genre=<genre> returns genre tracks.
[ ] Mini-player and visualizers behave as verified locally.
```

---

## Self-Review

- Spec coverage:
  - Lyrics popup: Task 4.
  - AI genre assignment: Task 1.
  - Home card paused bars: Task 5.
  - Mini-player fallback progress: Task 5.
  - Genre search: Tasks 2 and 3.
  - Visualizer palette coverage: Task 6.
  - Mini visualizer response: Task 7.
  - Upload fixes remain verified: Task 8.
  - Deploy after local verification: Task 9.
- Placeholder scan: no `TBD`, `TODO`, or undefined implementation placeholders remain.
- Type consistency:
  - `SearchResults.tracks[].genre` is added in API type and returned by backend mapping.
  - `searchApi.search(accessToken, query, activeTab, genre)` matches SearchPage usage.
  - AI helper `_select_primary_genre` is defined before tests import it.
