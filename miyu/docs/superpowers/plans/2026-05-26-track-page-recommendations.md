# Track Page Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit other-artist recommendations, replace the passive three-dot track action with playlist add/remove, and remove the animated track-page loading spinner.

**Architecture:** Keep this as a focused `TrackPage.tsx` change because the needed data and player playlist API are already available there. Use the existing `PlayerContext` playlist methods instead of adding new API calls, and rename the current discovery section to make the other-artist recommendation intent clear.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, lucide-react, existing `usePlayer()` context.

---

## File Structure

- Modify: `frontend/src/pages/TrackPage.tsx`
  - Remove unused `MoreHorizontal` and `Loader2` imports.
  - Add local `showPlaylistMenu` state.
  - Change loading branch to return `null`.
  - Replace the passive three-dot button with a `ListMusic` playlist button and dropdown.
  - Rename and clarify the `discoveryTracks` section as other-artist recommendations.
- No new files are required.
- No backend changes are required.

---

### Task 1: Remove the track-page loading spinner

**Files:**
- Modify: `frontend/src/pages/TrackPage.tsx:1-128`

- [ ] **Step 1: Update imports**

In `frontend/src/pages/TrackPage.tsx`, change the lucide import from:

```tsx
import { Music, Pause, Play, Heart, FileText, Mic, ListMusic, X, MoreHorizontal, Loader2, Disc, ArrowRight } from 'lucide-react'
```

to:

```tsx
import { Music, Pause, Play, Heart, FileText, Mic, ListMusic, X, Disc, ArrowRight } from 'lucide-react'
```

- [ ] **Step 2: Replace the loading branch**

In `frontend/src/pages/TrackPage.tsx`, replace:

```tsx
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }
```

with:

```tsx
  if (loading) {
    return null
  }
```

- [ ] **Step 3: Run the frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: build completes without TypeScript errors about `Loader2` or unused imports.

---

### Task 2: Add playlist dropdown state and close behavior

**Files:**
- Modify: `frontend/src/pages/TrackPage.tsx:8-18`

- [ ] **Step 1: Add menu state**

In `TrackPage`, after the existing `showLyrics` state:

```tsx
  const [showLyrics, setShowLyrics] = useState(false)
```

add:

```tsx
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false)
```

The top of the component should become:

```tsx
export default function TrackPage() {
  const { id } = useParams()
  const [track, setTrack] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isLiked, setIsLiked] = useState(false)
  const [showLyrics, setShowLyrics] = useState(false)
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false)
  const [catalogTracks, setCatalogTracks] = useState<any[]>([])
  const player = usePlayer()
```

- [ ] **Step 2: Close playlist menu on track change**

In the existing `useEffect` that starts with:

```tsx
  useEffect(() => {
    async function fetchTrack() {
```

insert these lines immediately inside the effect, before `async function fetchTrack()`:

```tsx
    setShowPlaylistMenu(false)
```

The beginning of the effect should be:

```tsx
  useEffect(() => {
    setShowPlaylistMenu(false)

    async function fetchTrack() {
      try {
```

- [ ] **Step 3: Run the frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: build completes without React hook or TypeScript errors.

---

### Task 3: Replace the three-dot action with add-to-playlist UI

**Files:**
- Modify: `frontend/src/pages/TrackPage.tsx:169-197`

- [ ] **Step 1: Replace the passive three-dot button**

In `frontend/src/pages/TrackPage.tsx`, replace this block:

```tsx
            <button className="p-3 rounded-full bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/10 transition duration-200">
              <MoreHorizontal className="w-5 h-5" />
            </button>
```

with this dropdown:

```tsx
            <div className="relative">
              <button
                onClick={() => setShowPlaylistMenu((open) => !open)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition duration-200 ${
                  showPlaylistMenu ? 'bg-white/10 text-white' : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/10'
                }`}
                title="Добавить в плейлист"
              >
                <ListMusic className="w-5 h-5" />
              </button>

              {showPlaylistMenu && (
                <div className="absolute left-0 top-full z-30 mt-3 w-56 rounded-2xl border border-white/10 bg-black/90 p-2 shadow-2xl backdrop-blur">
                  <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                    Добавить в плейлист
                  </p>
                  {player.playlists.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto">
                      {player.playlists.map((playlist) => {
                        const isInPlaylist = player.isTrackInPlaylist(playlist.id)
                        return (
                          <button
                            key={playlist.id}
                            onClick={() => {
                              player.addOrRemoveFromPlaylist(playlist.id)
                              setShowPlaylistMenu(false)
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                              isInPlaylist ? 'text-purple-300' : 'text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span className="truncate">{playlist.title}</span>
                            {isInPlaylist && <span className="text-xs text-purple-300">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="px-3 py-2 text-sm text-white/40">У тебя пока нет плейлистов</p>
                  )}
                </div>
              )}
            </div>
```

- [ ] **Step 2: Run the frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: build completes without errors about `MoreHorizontal`, `ListMusic`, `playlist`, or `showPlaylistMenu`.

- [ ] **Step 3: Manual UI check**

Open a track page while authenticated.

Expected:

- the three-dot icon is gone;
- a `ListMusic` button is shown near play/like/lyrics;
- clicking it opens `Добавить в плейлист`;
- clicking a playlist adds/removes the current track using existing toast behavior;
- the menu closes after selecting a playlist.

---

### Task 4: Rename the other-artist recommendation section

**Files:**
- Modify: `frontend/src/pages/TrackPage.tsx:99-105`
- Modify: `frontend/src/pages/TrackPage.tsx:261-290`

- [ ] **Step 1: Keep the other-artist filtering explicit**

Confirm `discoveryTracks` remains:

```tsx
  const discoveryTracks = useMemo(() => {
    if (!track) return []
    return catalogTracks
      .filter((item) => item.id !== track.id && item.artist_id !== track.artist_id)
      .filter((item) => !track.genre || item.genre === track.genre)
      .slice(0, 6)
  }, [catalogTracks, track])
```

This satisfies the requirement that recommendations exclude the current artist and prefer the same genre.

- [ ] **Step 2: Rename the section title and subtitle**

In the `discoveryTracks.length > 0` section, replace:

```tsx
                  <h2 className="text-2xl font-bold">Продолжить открытие</h2>
                  <p className="mt-1 text-sm text-white/40">Ещё несколько треков рядом по атмосфере и жанру</p>
```

with:

```tsx
                  <h2 className="text-2xl font-bold">Рекомендуемые треки других артистов</h2>
                  <p className="mt-1 text-sm text-white/40">Треки похожего жанра от исполнителей, которых здесь ещё не было</p>
```

- [ ] **Step 3: Run the frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: build completes successfully.

- [ ] **Step 4: Manual recommendation check**

Open a track page for a track that has a genre and at least one catalog neighbor.

Expected:

- the section title is `Рекомендуемые треки других артистов`;
- listed tracks do not have the same `artist_id` as the current track;
- clicking `Слушать` starts the chosen recommended track.

---

### Task 5: Final verification

**Files:**
- Verify: `frontend/src/pages/TrackPage.tsx`

- [ ] **Step 1: Run build**

Run:

```bash
cd frontend && npm run build
```

Expected: successful Vite production build.

- [ ] **Step 2: Inspect changed file diff**

Run:

```bash
git diff -- frontend/src/pages/TrackPage.tsx docs/superpowers/specs/2026-05-26-track-page-recommendations-design.md docs/superpowers/plans/2026-05-26-track-page-recommendations.md
```

Expected:

- `TrackPage.tsx` only contains the spinner removal, playlist dropdown, and recommendation title/subtitle change;
- spec and plan files describe the same scope;
- no unrelated files are modified by this work.

- [ ] **Step 3: Do not commit unless explicitly requested**

This repository currently has many unrelated uncommitted changes. Do not create commits unless Denis explicitly asks for a commit.

---

## Self-Review

- Spec coverage: loading spinner removal is covered by Task 1; playlist dropdown is covered by Tasks 2-3; other-artist recommendations are covered by Task 4; verification is covered by Task 5.
- Placeholder scan: no TBD/TODO/fill-in steps remain.
- Type consistency: the plan uses existing `player.playlists`, `player.addOrRemoveFromPlaylist`, and `player.isTrackInPlaylist` from `PlayerContext`; playlist titles use the existing `Playlist.title` field.
