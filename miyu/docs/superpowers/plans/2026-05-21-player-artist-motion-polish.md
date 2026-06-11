# Player, Artist Page, Visualizer, and Navigation Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement approved frontend polish: clickable expanded-player metadata links, redesigned ArtistPage content cards with animated artist palette reveal, smoother audio visualizer activation, and unified page transitions.

**Architecture:** This is a targeted frontend polish release. Changes stay inside the existing React/Tailwind/Framer Motion patterns and modify only the components already responsible for each behavior: player metadata in `ExpandedPlayer`, artist content in `ArtistPage`, canvas animation in visualizer components, and route-level animation in `PageContent`/`SearchPage`.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, React Router DOM, existing `usePlayer` context, existing `extractColorsFromImage` utility.

---

## Scope check

The spec covers four UI areas, but they are part of one coherent frontend polish release and can ship together without backend changes. Each task below is independently verifiable and touches a small file set.

No frontend test runner is configured in this project. Verification uses `npm run build`, `npm run lint`, and manual browser checks. Do not add Vitest/Jest in this plan; that would expand scope beyond the requested UI polish.

Commits require explicit user approval in this environment. Commit commands are included as checkpoint recipes only; do not run them unless the coordinator/user has authorized commits for this implementation.

## File structure

### Modify: `frontend/src/components/ExpandedPlayer.tsx`
Responsibility: expanded music player UI. Add React Router links for artist, playlist, and album metadata. Collapse expanded player when navigating from metadata links while leaving playback state untouched.

### Modify: `frontend/src/pages/ArtistPage.tsx`
Responsibility: public artist profile page. Redesign hero/content sections, animate palette reveal from avatar/custom/default colors, and improve track/album cards.

### Modify: `frontend/src/components/AudioVisualizer.tsx`
Responsibility: main homepage canvas visualizer. Add an activity envelope that smooths idle-to-active and active-to-idle transitions without restarting the animation loop.

### Modify: `frontend/src/components/MiniAudioVisualizer.tsx`
Responsibility: compact canvas visualizer in navigation/sidebar contexts. Add matching activity envelope so small visualizer does not jump abruptly.

### Modify: `frontend/src/components/PageContent.tsx`
Responsibility: route-level page transition wrapper. Add `AnimatePresence` and stronger fade/blur/y transition.

### Modify: `frontend/src/pages/SearchPage.tsx`
Responsibility: search UI and search-result tab transitions. Remove the page-level entrance wrapper that conflicts with global page transitions; keep internal result-tab animation.

---

## Task 1: Expanded player metadata links

**Files:**
- Modify: `frontend/src/components/ExpandedPlayer.tsx`

- [ ] **Step 1: Inspect current player metadata rendering**

Open `frontend/src/components/ExpandedPlayer.tsx` and confirm the metadata block still looks like this near the player view title:

```tsx
<div className="mb-3">
  <h3 className="truncate text-xl font-bold max-[414px]:text-center max-[414px]:text-lg">{currentTrack?.title || 'Трек не выбран'}</h3>
  <p className="truncate text-sm text-gray-400 max-[414px]:text-center max-[414px]:text-xs">
    {currentTrack?.artist?.username || 'Артист'}
    {currentPlaylist && ` • ${currentPlaylist.title}`}
    {!currentPlaylist && currentTrack?.album?.title && ` • ${currentTrack.album.title}`}
  </p>
  {isWaveActive && (
    <div className="mt-2 flex justify-start max-[414px]:justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
        <Waves className="h-3.5 w-3.5" />
        Волна Miyu
      </span>
    </div>
  )}
</div>
```

Expected: this block exists and is plain text today.

- [ ] **Step 2: Add React Router Link import**

Replace the top import section with this import addition:

```tsx
import { Link } from 'react-router-dom'
```

The top of the file should start like this:

```tsx
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { usePlayer } from '../hooks/PlayerContext'
import { motion, AnimatePresence } from 'framer-motion'
```

Expected: TypeScript can resolve `Link` from existing `react-router-dom` dependency.

- [ ] **Step 3: Add metadata target helpers**

After the existing derived values:

```tsx
const coverPath = currentTrack?.cover_url || currentTrack?.album?.cover_url
const coverUrl = coverPath ? coverPath : undefined
const hasLyrics = lyricsSegments.length > 0 || lyricsText.trim().length > 0
```

insert this code:

```tsx
const artistId = currentTrack?.artist?.id || currentTrack?.artist_id
const artistName = currentTrack?.artist?.username || 'Артист'
const canLinkArtist = Boolean(artistId && artistId > 0)
const playlistTarget = currentPlaylist && currentPlaylist.id > 0
  ? { to: `/playlist/${currentPlaylist.id}`, title: currentPlaylist.title }
  : null
const albumTarget = !playlistTarget && currentTrack?.album?.id
  ? { to: `/album/${currentTrack.album.id}`, title: currentTrack.album.title }
  : null
const secondaryTarget = playlistTarget || albumTarget

const handleMetaNavigate = () => {
  setActivePopup(null)
  setShowPresetMenu(false)
  toggleExpanded()
}
```

Expected: playlists with negative/system ids such as Miyu Wave do not become broken links.

- [ ] **Step 4: Replace metadata paragraph with linked metadata**

Replace the `<p className="truncate text-sm...">...</p>` metadata paragraph with:

```tsx
<div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 truncate text-sm text-gray-400 max-[414px]:justify-center max-[414px]:text-xs">
  {canLinkArtist ? (
    <Link
      to={`/artist/${artistId}`}
      onClick={handleMetaNavigate}
      className="truncate transition-colors hover:text-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      {artistName}
    </Link>
  ) : (
    <span className="truncate">{artistName}</span>
  )}

  {secondaryTarget && (
    <>
      <span className="text-white/25">•</span>
      <Link
        to={secondaryTarget.to}
        onClick={handleMetaNavigate}
        className="truncate transition-colors hover:text-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        {secondaryTarget.title}
      </Link>
    </>
  )}
</div>
```

Expected behavior: clicking artist navigates to `/artist/:id`; clicking playlist navigates to `/playlist/:id`; clicking album navigates to `/album/:id`; expanded player collapses; music keeps playing.

- [ ] **Step 5: Build-check this isolated change**

Run:

```bash
cd frontend
npm run build
```

Expected: build completes. If it fails because `artistId` is possibly undefined in the template literal, change the link target to `to={`/artist/${Number(artistId)}`}` inside the `canLinkArtist` branch and rerun.

- [ ] **Step 6: Checkpoint diff**

Run:

```bash
git diff -- frontend/src/components/ExpandedPlayer.tsx
```

Expected diff: import added, helper constants added, metadata paragraph replaced. No playback context or audio state logic changed.

Commit checkpoint only if commits are authorized:

```bash
git add frontend/src/components/ExpandedPlayer.tsx
git commit -m "feat(player): link expanded metadata navigation"
```

---

## Task 2: ArtistPage palette reveal and content redesign

**Files:**
- Modify: `frontend/src/pages/ArtistPage.tsx`

- [ ] **Step 1: Add Framer Motion import**

Change imports at the top of `frontend/src/pages/ArtistPage.tsx` from:

```tsx
import { useEffect, useRef, useState } from 'react'
```

or the current React import line to:

```tsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
```

Keep the existing imports for `Link`, `useParams`, icons, `usePlayer`, `extractColorsFromImage`, and `getStoredTokens`.

Expected: `motion` is available for palette overlay animation.

- [ ] **Step 2: Add default palette constant**

Above `export default function ArtistPage()`, add:

```tsx
const DEFAULT_ARTIST_PALETTE = ['#a855f7', '#ec4899', '#3b82f6']
```

Expected: palette fallback is a single shared value.

- [ ] **Step 3: Add palette reveal state**

In the state declarations, replace:

```tsx
const [bannerColors, setBannerColors] = useState<string[]>(['#a855f7', '#ec4899', '#3b82f6'])
```

with:

```tsx
const [bannerColors, setBannerColors] = useState<string[]>(DEFAULT_ARTIST_PALETTE)
const [paletteReady, setPaletteReady] = useState(false)
```

Expected: page can distinguish initial default render from revealed palette.

- [ ] **Step 4: Reset palette when artist id changes**

After the existing effect that calls `loadArtistData()` and `checkFollowStatus()`, add:

```tsx
useEffect(() => {
  setBannerColors(DEFAULT_ARTIST_PALETTE)
  setPaletteReady(false)
}, [id])
```

Expected: navigating between artists does not keep the previous artist's palette during loading.

- [ ] **Step 5: Replace palette extraction effect**

Replace the current effect that starts with:

```tsx
useEffect(() => {
  if (artist?.avatar_url) {
```

with this full effect:

```tsx
useEffect(() => {
  if (!artist) return

  let cancelled = false

  const revealPalette = (colors: string[]) => {
    if (cancelled) return
    setBannerColors(colors)
    requestAnimationFrame(() => {
      if (!cancelled) setPaletteReady(true)
    })
  }

  const paletteMode = artist.palette_mode || 'auto'
  if (paletteMode === 'custom' && artist.palette_primary && artist.palette_secondary && artist.palette_tertiary) {
    revealPalette([artist.palette_primary, artist.palette_secondary, artist.palette_tertiary])
    return () => {
      cancelled = true
    }
  }

  if (!artist.avatar_url) {
    revealPalette(DEFAULT_ARTIST_PALETTE)
    return () => {
      cancelled = true
    }
  }

  extractColorsFromImage(`${artist.avatar_url}`)
    .then((colors) => revealPalette(colors.length >= 3 ? colors.slice(0, 3) : DEFAULT_ARTIST_PALETTE))
    .catch(() => revealPalette(DEFAULT_ARTIST_PALETTE))

  return () => {
    cancelled = true
  }
}, [artist])
```

Expected: custom palette wins, avatar-derived palette follows, default palette is fallback.

- [ ] **Step 6: Add derived style constants before return**

After `const hasAvatar = !!artist.avatar_url`, replace the old `bgStyle` block with:

```tsx
const accentGradient = `linear-gradient(135deg, ${bannerColors[0]}, ${bannerColors[1]})`
const pageBackground = {
  background: `linear-gradient(135deg, ${bannerColors[0]}10, ${bannerColors[1]}0d, ${bannerColors[2]}10)`,
}
const auraBackground = `radial-gradient(circle at 18% 12%, ${bannerColors[0]}42, transparent 34%), radial-gradient(circle at 82% 8%, ${bannerColors[1]}36, transparent 30%), radial-gradient(circle at 50% 100%, ${bannerColors[2]}2c, transparent 38%)`
const softBorderColor = `${bannerColors[0]}33`
const activeBorderColor = `${bannerColors[0]}66`
```

Expected: JSX can reuse palette consistently.

- [ ] **Step 7: Replace root wrapper and hero opening**

Replace the root return opening from:

```tsx
return (
  <div className="min-h-[calc(100vh-200px)] rounded-2xl p-6 will-change-transform transition-all duration-700" style={bgStyle}>
    <div className="flex flex-col md:flex-row gap-6 mb-8">
```

with:

```tsx
return (
  <div className="relative min-h-[calc(100vh-200px)] overflow-hidden rounded-[2rem] border border-white/[0.05] p-4 transition-[background,border-color,box-shadow] duration-1000 md:p-6" style={pageBackground}>
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
      initial={false}
      animate={{ opacity: paletteReady ? 1 : 0.18 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      style={{ background: auraBackground }}
    />
    <div className="relative space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-black/20 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-7" style={{ borderColor: softBorderColor }}>
        <div className="flex flex-col gap-6 md:flex-row md:items-end">
```

Expected: page background has an animated palette aura and content remains above it.

- [ ] **Step 8: Replace hero avatar block**

Replace the old avatar block:

```tsx
<div className="w-40 h-40 md:w-52 md:h-52 rounded-full ...">
  ...
</div>
```

with:

```tsx
<div className="relative mx-auto h-40 w-40 shrink-0 rounded-full p-1 md:mx-0 md:h-52 md:w-52" style={{ background: accentGradient }}>
  <div className="absolute inset-0 rounded-full blur-2xl opacity-40" style={{ background: accentGradient }} />
  <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/15 bg-black/40">
    {hasAvatar ? (
      <img src={`${artist.avatar_url}`} alt={artist.username} className="h-full w-full object-cover" />
    ) : (
      <div className="flex h-full w-full items-center justify-center" style={{ background: accentGradient }}>
        <Mic size={80} className="text-white/90" />
      </div>
    )}
  </div>
</div>
```

Expected: avatar has gradient ring and glow from palette.

- [ ] **Step 9: Replace hero text/actions block**

Replace the old hero text/actions block from `<div className="flex-1 flex flex-col">` through its closing `</div>` before the hero container closes with:

```tsx
<div className="flex min-w-0 flex-1 flex-col text-center md:text-left">
  <div className="mb-5">
    <p className="mb-2 text-xs uppercase tracking-[0.24em] text-white/40">Артист</p>
    <h1 className="mb-3 flex items-center justify-center gap-3 text-3xl font-black md:justify-start md:text-5xl">
      <span className="truncate">{artist.username}</span>
      {artist.is_verified && <CheckCircle2 size={28} className="shrink-0 text-purple-300" />}
    </h1>
    {artist.bio && (
      <p className="mx-auto max-w-2xl text-sm leading-relaxed text-white/60 md:mx-0">{artist.bio}</p>
    )}
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
      <span className="rounded-full border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-sm text-white/65">{tracks.length} треков</span>
      <span className="rounded-full border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-sm text-white/65">{albums.length} альбомов</span>
      <span className="rounded-full border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-sm text-white/65">палитра артиста</span>
    </div>
  </div>

  <div className="mt-auto flex items-center justify-center gap-3 md:justify-start">
    <button
      onClick={handlePlayAll}
      disabled={tracks.length === 0}
      className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ background: accentGradient }}
      aria-label="Воспроизвести треки артиста"
    >
      {player.isPlaying && player.currentTrack && tracks.some(t => t.id === player.currentTrack?.id) ? (
        <Pause size={28} className="text-white" />
      ) : (
        <Play size={28} className="ml-1 text-white" />
      )}
    </button>
    <button className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.06] transition hover:border-white/[0.15] hover:bg-white/[0.1]" aria-label="Дополнительные действия">
      <MoreHorizontal className="h-5 w-5" />
    </button>
  </div>
</div>
```

Then close the hero wrappers with:

```tsx
        </div>
      </section>
```

Expected: hero is a cohesive glass panel with palette-aware actions.

- [ ] **Step 10: Replace tracks section**

Replace the entire existing tracks section:

```tsx
{tracks.length > 0 && (
  <section className="mb-8">
    ...
  </section>
)}
```

with:

```tsx
{tracks.length > 0 && (
  <section className="rounded-[2rem] border border-white/[0.06] bg-black/20 p-4 backdrop-blur-xl md:p-6" style={{ borderColor: softBorderColor }}>
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/35">artist tracks</p>
        <h2 className="mt-2 text-2xl font-bold">Популярные треки</h2>
        <p className="mt-1 text-sm text-white/45">Главные треки артиста в обновлённой витрине Miyu</p>
      </div>
      <Link to={`/user/${id}`} className="text-sm text-white/45 transition hover:text-white">Смотреть все</Link>
    </div>

    <div className="space-y-2.5">
      {tracks.map((track, i) => {
        const isCurrentTrack = player.currentTrack?.id === track.id
        const isPlaying = player.isPlaying && isCurrentTrack

        return (
          <button
            key={track.id}
            type="button"
            className="group grid w-full grid-cols-[2rem,3.5rem,minmax(0,1fr),auto] items-center gap-3 rounded-2xl border bg-white/[0.025] p-3 text-left transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.05] max-[414px]:grid-cols-[2.75rem,minmax(0,1fr),auto]"
            style={{ borderColor: isCurrentTrack ? activeBorderColor : 'rgba(255,255,255,0.05)' }}
            onClick={() => handlePlayTrack(track)}
          >
            <span className="text-center text-sm font-medium text-white/35 max-[414px]:hidden">{i + 1}</span>
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-white/[0.04] max-[414px]:h-11 max-[414px]:w-11" style={{ backgroundColor: `${bannerColors[0]}20` }}>
              {track.cover_url ? (
                <img src={track.cover_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Music className="h-5 w-5 text-white/40" />
                </div>
              )}
              {isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                  <div className="flex h-4 items-end gap-0.5">
                    <div className="w-0.5 animate-music-bar-1 rounded-full bg-white" />
                    <div className="mx-0.5 w-0.5 animate-music-bar-2 rounded-full bg-white" />
                    <div className="w-0.5 animate-music-bar-3 rounded-full bg-white" />
                  </div>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className={`truncate text-sm font-semibold transition ${isCurrentTrack ? 'text-white' : 'text-white/88 group-hover:text-white'}`}>{track.title}</p>
              <p className="mt-1 truncate text-xs text-white/40">{new Date(track.created_at).toLocaleDateString('ru')} • трек артиста</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/35 max-[414px]:hidden">{formatDuration(track.duration)}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/55 transition group-hover:bg-white group-hover:text-black">
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  </section>
)}
```

Expected: track rows become palette-aware glass rows with mobile-safe columns.

- [ ] **Step 11: Replace albums section**

Replace the entire existing albums section:

```tsx
{albums.length > 0 && (
  <section className="mb-8">
    ...
  </section>
)}
```

with:

```tsx
{albums.length > 0 && (
  <section className="rounded-[2rem] border border-white/[0.06] bg-black/20 p-4 backdrop-blur-xl md:p-6" style={{ borderColor: softBorderColor }}>
    <div className="mb-5">
      <p className="text-xs uppercase tracking-[0.24em] text-white/35">artist releases</p>
      <h2 className="mt-2 text-2xl font-bold">Альбомы</h2>
      <p className="mt-1 text-sm text-white/45">Релизы артиста в едином glass-стиле</p>
    </div>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {albums.map((album) => (
        <Link key={album.id} to={`/album/${album.id}`} className="group rounded-3xl border border-white/[0.06] bg-white/[0.025] p-3 transition duration-300 hover:-translate-y-1 hover:border-white/[0.14] hover:bg-white/[0.05]">
          <div className="relative mb-3 aspect-square overflow-hidden rounded-2xl bg-white/[0.03]">
            {album.cover_url ? (
              <img src={album.cover_url} alt={album.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            ) : (
              <div className="flex h-full w-full items-center justify-center" style={{ background: accentGradient }}>
                <Disc size={36} className="text-white/75" />
              </div>
            )}
            <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3 opacity-0 transition duration-300 group-hover:opacity-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg">
                <Play className="ml-0.5 h-5 w-5" />
              </span>
            </div>
          </div>
          <p className="truncate text-sm font-semibold transition group-hover:text-purple-200">{album.title}</p>
          <p className="mt-1 text-xs text-white/40">{new Date(album.release_date).getFullYear()} • {album.type}</p>
        </Link>
      ))}
    </div>
  </section>
)}
```

Expected: album cards align visually with track section.

- [ ] **Step 12: Replace empty state and close wrappers**

Replace the existing empty state:

```tsx
{tracks.length === 0 && albums.length === 0 && (
  <div className="text-center py-20">
    <Music className="w-16 h-16 mx-auto mb-4 text-white/20" />
    <p className="text-white/40">У этого артиста пока нет треков</p>
  </div>
)}
```

with:

```tsx
{tracks.length === 0 && albums.length === 0 && (
  <div className="rounded-[2rem] border border-white/[0.06] bg-black/20 px-6 py-16 text-center backdrop-blur-xl" style={{ borderColor: softBorderColor }}>
    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.06]" style={{ boxShadow: `0 0 40px ${bannerColors[0]}22` }}>
      <Music className="h-8 w-8 text-white/35" />
    </div>
    <h2 className="text-2xl font-bold">У артиста пока нет релизов</h2>
    <p className="mx-auto mt-2 max-w-md text-sm text-white/45">Когда появятся треки или альбомы, они отобразятся здесь в цветовой палитре артиста.</p>
  </div>
)}
```

Make sure the final wrapper closing after this block is:

```tsx
    </div>
  </div>
)
```

Expected: root palette wrapper closes correctly and TypeScript JSX compiles.

- [ ] **Step 13: Build-check ArtistPage**

Run:

```bash
cd frontend
npm run build
```

Expected: build completes. Common fixes:

- If `album.release_date` can be undefined according to TypeScript, use `new Date(album.release_date || Date.now()).getFullYear()`.
- If Tailwind class `text-white/88` fails visual expectation, replace it with `text-white/85` if project build complains. Tailwind JIT should support slash opacity values in the configured version.

- [ ] **Step 14: Checkpoint diff**

Run:

```bash
git diff -- frontend/src/pages/ArtistPage.tsx
```

Expected diff: palette state/effect added, hero wrapper replaced, tracks section replaced, albums section replaced, empty state replaced. Backend calls remain unchanged.

Commit checkpoint only if commits are authorized:

```bash
git add frontend/src/pages/ArtistPage.tsx
git commit -m "feat(artist): refresh content cards with palette reveal"
```

---

## Task 3: Smooth main AudioVisualizer active/idle transition

**Files:**
- Modify: `frontend/src/components/AudioVisualizer.tsx`

- [ ] **Step 1: Add envelope state inside RAF setup**

In `AudioVisualizer.tsx`, find these local variables inside the canvas effect:

```tsx
let smoothBass = 0
let smoothMid = 0
let smoothTreble = 0
let smoothVocal = 0
let smoothPresence = 0
```

Immediately after them add:

```tsx
let activityEnvelope = 0
```

Expected: envelope persists across animation frames because it is in the effect closure.

- [ ] **Step 2: Compute eased envelope after idle calculation**

Find the block that computes `const idle = !isPlayingRef.current || total < 0.005` and the following idle value assignment. Immediately after the idle assignment block, add:

```tsx
const envelopeTarget = idle ? 0 : 1
activityEnvelope += (envelopeTarget - activityEnvelope) * (envelopeTarget > activityEnvelope ? 0.045 : 0.025)
const easedEnvelope = activityEnvelope * activityEnvelope * (3 - 2 * activityEnvelope)
const activeResponse = 0.25 + easedEnvelope * 0.75
```

Expected: active response starts at 25% and ramps to 100%, avoiding a hard jump on intense audio frames.

- [ ] **Step 3: Gate beat detection with envelope**

Replace the current beat detection condition:

```tsx
const isBeat =
  !idle &&
  bass > bassAvg * 1.45 &&
  bass > 0.22 &&
  t - lastBeatT > 10
```

with:

```tsx
const isBeat =
  !idle &&
  easedEnvelope > 0.18 &&
  bass > bassAvg * 1.45 &&
  bass > 0.22 &&
  t - lastBeatT > 10
```

Then replace:

```tsx
for (let i = 0; i < RING_COUNT; i++) ringBeatEnv[i] = 1
```

with:

```tsx
for (let i = 0; i < RING_COUNT; i++) ringBeatEnv[i] = easedEnvelope
```

Expected: beats do not create full-strength spikes before the visualizer has eased into active state.

- [ ] **Step 4: Smooth global frequency values through the envelope**

Replace the smoothing block:

```tsx
smoothBass += (bass - smoothBass) * 0.18
smoothMid += (mid - smoothMid) * 0.15
smoothTreble += (treble - smoothTreble) * 0.2
smoothVocal += (vocal - smoothVocal) * 0.22
smoothPresence += (presence - smoothPresence) * 0.16
```

with:

```tsx
const globalResponse = idle ? 1 : activeResponse
smoothBass += (bass * globalResponse - smoothBass) * (idle ? 0.12 : 0.1 + easedEnvelope * 0.08)
smoothMid += (mid * globalResponse - smoothMid) * (idle ? 0.1 : 0.09 + easedEnvelope * 0.06)
smoothTreble += (treble * globalResponse - smoothTreble) * (idle ? 0.12 : 0.11 + easedEnvelope * 0.09)
smoothVocal += (vocal * globalResponse - smoothVocal) * (idle ? 0.12 : 0.1 + easedEnvelope * 0.12)
smoothPresence += (presence * globalResponse - smoothPresence) * (idle ? 0.11 : 0.09 + easedEnvelope * 0.07)
```

Expected: global glow/energy values ramp in and out smoothly.

- [ ] **Step 5: Gate per-ring raw amplitudes and smoothing**

Inside the per-ring band sampling loop, after the idle override block:

```tsx
if (idle) {
  raw = 0.015 + 0.012 * Math.sin(t * 0.012 + i * 0.7)
  voiceRaw = 0.015 + 0.01 * Math.sin(t * 0.014 + i * 0.9)
}
```

add:

```tsx
if (!idle) {
  raw *= activeResponse
  voiceRaw *= activeResponse
}
```

Then replace:

```tsx
ringBands[i] = prev + (raw - prev) * (raw > prev ? 0.45 : 0.10)
const voicePrev = ringVoiceBands[i]
ringVoiceBands[i] = voicePrev + (voiceRaw - voicePrev) * (voiceRaw > voicePrev ? 0.55 : 0.12)
```

with:

```tsx
ringBands[i] = prev + (raw - prev) * (raw > prev ? lerp(0.16, 0.45, easedEnvelope) : lerp(0.08, 0.10, easedEnvelope))
const voicePrev = ringVoiceBands[i]
ringVoiceBands[i] = voicePrev + (voiceRaw - voicePrev) * (voiceRaw > voicePrev ? lerp(0.18, 0.55, easedEnvelope) : lerp(0.08, 0.12, easedEnvelope))
```

Expected: ring deformation has slower attack at playback start and keeps existing responsiveness once active.

- [ ] **Step 6: Gate active visual boosts**

In the rendering loop, replace:

```tsx
const tempoSpeed = idle ? 0 : (60 / Math.max(20, smoothInterval)) * 0.0035
```

with:

```tsx
const tempoSpeed = idle ? 0 : easedEnvelope * (60 / Math.max(20, smoothInterval)) * 0.0035
```

Replace:

```tsx
const beat = ringBeatEnv[i]
const boostedBand = Math.min(1, band * 1.25)
const boostedVoice = Math.min(1, voiceBand * 1.55)
```

with:

```tsx
const beat = ringBeatEnv[i] * easedEnvelope
const boostedBand = Math.min(1, band * (0.75 + easedEnvelope * 0.5))
const boostedVoice = Math.min(1, voiceBand * (0.9 + easedEnvelope * 0.65))
```

Expected: shape, spin, and glow ramp with the envelope instead of jumping.

- [ ] **Step 7: Build-check visualizer**

Run:

```bash
cd frontend
npm run build
```

Expected: build completes; `lerp` already exists in this file, so no missing function error.

- [ ] **Step 8: Checkpoint diff**

Run:

```bash
git diff -- frontend/src/components/AudioVisualizer.tsx
```

Expected diff: only local animation math changed. No React state, no player context, no analyser subscription changes.

Commit checkpoint only if commits are authorized:

```bash
git add frontend/src/components/AudioVisualizer.tsx
git commit -m "fix(visualizer): smooth main activity envelope"
```

---

## Task 4: Smooth MiniAudioVisualizer active/idle transition

**Files:**
- Modify: `frontend/src/components/MiniAudioVisualizer.tsx`

- [ ] **Step 1: Add local lerp helper**

Near the top of `MiniAudioVisualizer.tsx`, after constants, add:

```tsx
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
```

Expected: mini visualizer can use the same envelope-based smoothing style as main visualizer.

- [ ] **Step 2: Add envelope state inside RAF setup**

Inside the canvas effect, find:

```tsx
let smoothBass = 0
let smoothVocal = 0
let smoothPresence = 0
```

Immediately after it add:

```tsx
let activityEnvelope = 0
```

Expected: envelope persists frame-to-frame while mini visualizer is mounted and visible.

- [ ] **Step 3: Compute envelope after idle calculation**

After:

```tsx
const idle = !isPlayingRef.current || total < 0.005
```

add:

```tsx
const envelopeTarget = idle ? 0 : 1
activityEnvelope += (envelopeTarget - activityEnvelope) * (envelopeTarget > activityEnvelope ? 0.06 : 0.035)
const easedEnvelope = activityEnvelope * activityEnvelope * (3 - 2 * activityEnvelope)
const activeResponse = 0.3 + easedEnvelope * 0.7
```

Expected: mini visualizer ramps slightly faster than main visualizer but still avoids hard jumps.

- [ ] **Step 4: Gate global smoothing**

Replace:

```tsx
smoothBass += (bass - smoothBass) * 0.18
smoothVocal += (vocal - smoothVocal) * 0.22
smoothPresence += (presence - smoothPresence) * 0.16
```

with:

```tsx
const globalResponse = idle ? 1 : activeResponse
smoothBass += (bass * globalResponse - smoothBass) * (idle ? 0.12 : 0.12 + easedEnvelope * 0.08)
smoothVocal += (vocal * globalResponse - smoothVocal) * (idle ? 0.12 : 0.12 + easedEnvelope * 0.12)
smoothPresence += (presence * globalResponse - smoothPresence) * (idle ? 0.11 : 0.1 + easedEnvelope * 0.08)
```

Expected: mini glow and line width do not spike instantly.

- [ ] **Step 5: Gate per-ring raw amplitudes**

Inside the per-ring sampling loop, after the idle override:

```tsx
if (idle) {
  raw = 0.02 + 0.015 * Math.sin(t * 0.012 + i * 0.7)
  voiceRaw = 0.018 + 0.012 * Math.sin(t * 0.014 + i * 0.9)
}
```

add:

```tsx
if (!idle) {
  raw *= activeResponse
  voiceRaw *= activeResponse
}
```

Then replace:

```tsx
ringBands[i] = prev + (raw - prev) * (raw > prev ? 0.45 : 0.10)
const voicePrev = ringVoiceBands[i]
ringVoiceBands[i] = voicePrev + (voiceRaw - voicePrev) * (voiceRaw > voicePrev ? 0.55 : 0.12)
```

with:

```tsx
ringBands[i] = prev + (raw - prev) * (raw > prev ? lerp(0.18, 0.45, easedEnvelope) : lerp(0.08, 0.10, easedEnvelope))
const voicePrev = ringVoiceBands[i]
ringVoiceBands[i] = voicePrev + (voiceRaw - voicePrev) * (voiceRaw > voicePrev ? lerp(0.2, 0.55, easedEnvelope) : lerp(0.08, 0.12, easedEnvelope))
```

Expected: mini rings ramp smoothly.

- [ ] **Step 6: Gate boosted band and voice values**

Replace:

```tsx
const boostedBand = Math.min(1, band * 1.2)
const boostedVoice = Math.min(1, voiceBand * 1.55)
```

with:

```tsx
const boostedBand = Math.min(1, band * (0.8 + easedEnvelope * 0.4))
const boostedVoice = Math.min(1, voiceBand * (0.9 + easedEnvelope * 0.65))
```

Expected: mini visualizer keeps musical movement without abrupt activation.

- [ ] **Step 7: Build-check mini visualizer**

Run:

```bash
cd frontend
npm run build
```

Expected: build completes; no missing `lerp` error.

- [ ] **Step 8: Checkpoint diff**

Run:

```bash
git diff -- frontend/src/components/MiniAudioVisualizer.tsx
```

Expected diff: local helper and animation math only.

Commit checkpoint only if commits are authorized:

```bash
git add frontend/src/components/MiniAudioVisualizer.tsx
git commit -m "fix(visualizer): smooth mini activity envelope"
```

---

## Task 5: Unified route page transitions

**Files:**
- Modify: `frontend/src/components/PageContent.tsx`
- Modify: `frontend/src/pages/SearchPage.tsx`
- Modify: `frontend/src/pages/ArtistPage.tsx` if a leftover root transition conflicts after Task 2

- [ ] **Step 1: Replace PageContent with AnimatePresence wrapper**

Replace the entire contents of `frontend/src/components/PageContent.tsx` with:

```tsx
import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

interface PageContentProps {
  children?: ReactNode
}

const pageTransition = {
  duration: 0.42,
  ease: [0.22, 1, 0.36, 1] as const,
}

export default function PageContent({ children }: PageContentProps) {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
        transition={pageTransition}
        className="will-change-[opacity,transform,filter]"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

Expected: route transitions now animate both exit and enter because `AnimatePresence` wraps the keyed motion element.

- [ ] **Step 2: Remove SearchPage outer page-level motion wrapper**

In `frontend/src/pages/SearchPage.tsx`, replace the return opening:

```tsx
return (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: 'easeInOut' }}
  >
```

with:

```tsx
return (
  <div>
```

At the end of the component, replace the matching closing:

```tsx
</motion.div>
```

with:

```tsx
</div>
```

Keep `motion` imported because the result-tab animation still uses `motion.section` and `motion.div`.

Expected: SearchPage no longer double-animates page entrance, but tab transitions remain.

- [ ] **Step 3: Confirm ArtistPage root is not a page-enter animation**

After Task 2, confirm the ArtistPage root wrapper class does not include the old broad animation:

```tsx
will-change-transform transition-all duration-700
```

Expected root class is the palette transition wrapper from Task 2:

```tsx
relative min-h-[calc(100vh-200px)] overflow-hidden rounded-[2rem] border border-white/[0.05] p-4 transition-[background,border-color,box-shadow] duration-1000 md:p-6
```

This is allowed because it animates palette/background, not page entrance.

- [ ] **Step 4: Build-check route transitions**

Run:

```bash
cd frontend
npm run build
```

Expected: build completes. If TypeScript rejects the tuple easing type, keep `as const` exactly on the `ease` array in `pageTransition`.

- [ ] **Step 5: Checkpoint diff**

Run:

```bash
git diff -- frontend/src/components/PageContent.tsx frontend/src/pages/SearchPage.tsx frontend/src/pages/ArtistPage.tsx
```

Expected diff: PageContent replaced, SearchPage outer wrapper changed to `div`, ArtistPage root still palette transition wrapper.

Commit checkpoint only if commits are authorized:

```bash
git add frontend/src/components/PageContent.tsx frontend/src/pages/SearchPage.tsx frontend/src/pages/ArtistPage.tsx
git commit -m "feat(ui): unify route page transitions"
```

---

## Task 6: Full frontend verification

**Files:**
- Read-only verification across `frontend/`

- [ ] **Step 1: Run production build**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript build and Vite build complete successfully with exit code 0.

- [ ] **Step 2: Run linter**

Run:

```bash
cd frontend
npm run lint
```

Expected: ESLint completes. If lint reports pre-existing warnings outside touched files, capture them separately and do not claim lint is clean. If lint reports issues in touched files, fix them before proceeding.

- [ ] **Step 3: Manual QA in browser**

Start dev server:

```bash
cd frontend
npm run dev
```

Open the local Vite URL and verify:

1. Expanded player metadata:
   - Start a track.
   - Open expanded player.
   - Click artist name.
   - Expected: route changes to `/artist/:id`, expanded player closes, music continues.
   - Open expanded player again from a playlist context.
   - Click playlist name.
   - Expected: route changes to `/playlist/:id`, expanded player closes, music continues.
   - Play a track with album metadata and no playlist context.
   - Click album name.
   - Expected: route changes to `/album/:id`, expanded player closes, music continues.

2. ArtistPage redesign:
   - Open `/artist/:id` for an artist with an avatar.
   - Expected: page first renders dark/default, then palette glow smoothly appears.
   - Open an artist without avatar.
   - Expected: default purple/pink/blue palette remains and page still looks polished.
   - Hover track rows and album cards.
   - Expected: hover states are smooth and no text overflows badly.
   - Resize to mobile width around 375–414px.
   - Expected: track rows and album grid remain readable.

3. Visualizer smoothing:
   - Go to home page.
   - Start a loud/intense track or Miyu Wave.
   - Expected: visualizer grows into active state smoothly, not with an instant jump.
   - Pause playback.
   - Expected: visualizer fades back to idle breathing smoothly.
   - Navigate away so mini visualizer appears.
   - Expected: mini visualizer has the same smoother start/stop behavior.

4. Page transitions:
   - Navigate between Home, Search, Artist, Track, and Settings pages.
   - Expected: old page fades/blurs out and new page fades/blurs in.
   - Search results tab switching still slides/fades internally.
   - ArtistPage does not have a separate conflicting page entrance animation.

- [ ] **Step 4: Review final diff**

Run:

```bash
git diff --stat
git diff -- frontend/src/components/ExpandedPlayer.tsx frontend/src/pages/ArtistPage.tsx frontend/src/components/AudioVisualizer.tsx frontend/src/components/MiniAudioVisualizer.tsx frontend/src/components/PageContent.tsx frontend/src/pages/SearchPage.tsx
```

Expected: only approved frontend files changed. Generated `.superpowers/` brainstorm files remain untracked and should not be committed unless the user explicitly asks to keep browser mockups.

- [ ] **Step 5: Final checkpoint commit recipe**

Only if commits are authorized for implementation, run:

```bash
git add frontend/src/components/ExpandedPlayer.tsx frontend/src/pages/ArtistPage.tsx frontend/src/components/AudioVisualizer.tsx frontend/src/components/MiniAudioVisualizer.tsx frontend/src/components/PageContent.tsx frontend/src/pages/SearchPage.tsx
git commit -m "$(cat <<'EOF'
feat(ui): polish player navigation and artist motion

Link expanded-player metadata to artist, playlist, and album pages while preserving playback. Refresh ArtistPage content sections with palette-aware glass cards and smooth avatar palette reveal.

Smooth main and mini audio visualizer activation with an activity envelope, and unify route-level page transitions across the app.

Co-Authored-By: OpenClaude (cx/gpt-5.5-xhigh) <openclaude@gitlawb.com>
EOF
)"
```

Expected: one implementation commit containing only the approved frontend changes.

---

## Self-review

### Spec coverage

- Expanded player links: Task 1.
- ArtistPage content cards redesign: Task 2.
- Palette from avatar/custom/default and animated reveal: Task 2 steps 3–7.
- Main visualizer smoothing: Task 3.
- Mini visualizer consistency: Task 4.
- Unified page transitions and SearchPage conflict removal: Task 5.
- Build/lint/manual verification: Task 6.

### Placeholder scan

This plan contains no open-ended implementation placeholders. Conditional instructions are limited to explicit build-failure fixes and commit authorization constraints.

### Type consistency

- `currentTrack`, `currentPlaylist`, `toggleExpanded`, and playback metadata match `usePlayer` context.
- `ArtistPage` uses its existing local `Artist`, `Track`, and `Album` interfaces.
- `extractColorsFromImage` is already imported and returns string colors.
- `lerp` already exists in `AudioVisualizer`; Task 4 adds it to `MiniAudioVisualizer`.
- `PageContent` uses `AnimatePresence` and `motion` from existing `framer-motion` dependency.
