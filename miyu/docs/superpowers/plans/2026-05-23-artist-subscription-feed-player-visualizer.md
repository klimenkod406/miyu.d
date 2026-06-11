# Artist Subscription Feed, Player Artist, and Visualizer Deformation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ArtistPage “favorite” language with artist subscription behavior, show new tracks and albums from subscribed artists in the activity feed, fix artist metadata when playing tracks from ArtistPage, and restore visible audio-driven visualizer deformation.

**Architecture:** Use the existing `follows` table and `/api/following` API as the subscription source to avoid a risky data migration. Add a focused backend feed route that derives release events from approved tracks/albums and normalizes them for the existing FeedPage, then make frontend feed rendering support both listen and release events. Fix ArtistPage track mapping at the source and tune visualizer geometry inputs so smoothing remains but active deformations are not double-gated away.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, React Router DOM, Express 5, SQLite, existing JWT auth middleware, existing `usePlayer` context.

---

## Scope check

This plan covers three related behavior fixes that share user-facing music discovery: artist subscriptions, feed visibility of subscribed artist releases, and player/visualizer correctness while playing artist content. It intentionally keeps the subscription model on existing `follows(follower_id, following_id)` and does not introduce migrations for `artist_follows`. No test runner is configured in frontend and backend `npm test` is a placeholder, so verification uses small Node assertion scripts plus `npm run build` for both frontend and backend.

Commits require explicit user approval in this environment. Commit commands are included only as checkpoint recipes; do not run them unless the coordinator/user authorizes commits.

## File structure

### Modify: `backend/index.ts`
Responsibility: Express app composition and legacy inline public `/api/tracks` and `/api/albums` endpoints. Mount the new feed route. Add `artist_id`/`artist_name` to public track payloads so older frontend mappings and player fallbacks work reliably.

### Create: `backend/routes/feed.ts`
Responsibility: `/api/feed` and `/api/feed/global`. Return normalized activity objects for listen activity and release activity. Personal feed includes listen activity from followed users plus `release_track` and `release_album` events from followed artists. Global feed includes recent listens plus global approved track/album release events.

### Modify: `frontend/src/pages/FeedPage.tsx`
Responsibility: activity feed UI. Load `/api/feed` for authenticated users instead of rebuilding personalization from `/api/feed/global` on the client. Render `release_track` and `release_album` event types, including albums without a playable track. Keep filters: all, friends, following, artists.

### Modify: `frontend/src/pages/ArtistPage.tsx`
Responsibility: concrete artist profile. Rename favorite language to subscription language and map nested `track.artist` from `/api/tracks?artist_id=` into player-compatible tracks with clickable artist metadata.

### Modify: `frontend/src/components/AudioVisualizer.tsx`
Responsibility: main homepage visualizer. Restore visible ring deformation by using smoothed FFT band values for geometry and applying the activity envelope once as a floor/scale rather than double-multiplying low signal into near zero.

### Modify: `frontend/src/components/MiniAudioVisualizer.tsx`
Responsibility: compact visualizer. Apply the same deformation restoration principles at mini scale.

---

## Task 1: Backend feed route and track payload normalization

**Files:**
- Create: `backend/routes/feed.ts`
- Modify: `backend/index.ts`

- [ ] **Step 1: Write a failing backend feed route assertion script**

Run this from repo root before implementing the route:

```bash
node -e "const fs=require('fs'); const index=fs.readFileSync('backend/index.ts','utf8'); const failures=[]; if (!fs.existsSync('backend/routes/feed.ts')) failures.push('backend/routes/feed.ts missing'); if (!/import feedRoutes from '\.\/routes\/feed'/.test(index)) failures.push('feed route import missing'); if (!/app\.use\('\/api\/feed', feedRoutes\)/.test(index)) failures.push('feed route mount missing'); if (!/t\.artist_id,\s*u\.username as artist_name/.test(index)) failures.push('/api/tracks does not expose artist_id and artist_name'); if (failures.length) { console.error(failures.join('\n')); process.exit(1); } console.log('backend feed route assertions passed');"
```

Expected: FAIL with messages including `backend/routes/feed.ts missing`, `feed route import missing`, `feed route mount missing`, and `/api/tracks does not expose artist_id and artist_name`.

- [ ] **Step 2: Create `backend/routes/feed.ts`**

Create `backend/routes/feed.ts` with this content:

```ts
import { Router, Response } from 'express';
import { getAll } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

type Audience = 'all' | 'friends' | 'following' | 'artists';

function normalizePath(value: any, prefix: '/uploads/tracks/' | '/uploads/albums/' | '/uploads/avatars/'): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (value.startsWith('http') || value.startsWith('/uploads/') || value.startsWith('data:image/')) return value;
  return `${prefix}${value}`;
}

function mapUser(row: any, idKey = 'user_id', usernameKey = 'username') {
  return {
    id: row[idKey],
    username: row[usernameKey],
    avatar_url: normalizePath(row.avatar_url, '/uploads/avatars/'),
    role: row.user_role || 'user',
    is_verified: !!row.is_verified,
    is_premium: !!row.is_premium,
    created_at: row.user_created_at || row.created_at,
  };
}

function mapArtist(row: any) {
  return {
    id: row.artist_id,
    username: row.artist_name,
    avatar_url: normalizePath(row.artist_avatar_url, '/uploads/avatars/'),
    role: 'artist' as const,
    is_verified: !!row.artist_is_verified,
    is_premium: !!row.artist_is_premium,
    created_at: row.artist_created_at || row.created_at,
  };
}

function mapTrack(row: any) {
  return {
    id: row.track_id,
    artist_id: row.artist_id,
    artist_name: row.artist_name,
    artist: mapArtist(row),
    album_id: row.album_id || undefined,
    album: row.album_id ? {
      id: row.album_id,
      artist_id: row.artist_id,
      title: row.album_title,
      cover_url: normalizePath(row.album_cover, '/uploads/albums/') || undefined,
      type: row.album_type || 'album',
      status: 'approved',
      created_at: row.album_created_at || row.created_at,
    } : undefined,
    title: row.track_title,
    duration: row.duration || 0,
    file_path: row.file_path || '',
    cover_url: normalizePath(row.track_cover, '/uploads/tracks/') || undefined,
    is_explicit: !!row.is_explicit,
    is_premium: !!row.is_premium,
    status: 'approved' as const,
    created_at: row.created_at,
  };
}

function mapAlbum(row: any) {
  return {
    id: row.album_id,
    artist_id: row.artist_id,
    artist: mapArtist(row),
    title: row.album_title,
    release_year: row.release_year || undefined,
    release_date: row.release_year ? `${row.release_year}-01-01` : row.created_at,
    cover_url: normalizePath(row.album_cover, '/uploads/albums/') || undefined,
    type: row.album_type || 'album',
    status: 'approved',
    created_at: row.created_at,
  };
}

async function getListenRows(whereSql: string, params: any[], limit: number) {
  return getAll<any>(`
    SELECT
      tp.id, tp.track_id, tp.user_id, tp.created_at,
      u.username, u.avatar_url, u.role as user_role, u.is_verified, u.is_premium, u.created_at as user_created_at,
      t.title as track_title, t.cover_url as track_cover, t.duration, t.file_path, t.is_explicit, t.is_premium as track_is_premium, t.album_id,
      a.title as album_title, a.cover_url as album_cover, a.type as album_type, a.created_at as album_created_at,
      ar.username as artist_name, ar.id as artist_id, ar.avatar_url as artist_avatar_url,
      ar.is_verified as artist_is_verified, ar.is_premium as artist_is_premium, ar.created_at as artist_created_at
    FROM track_plays tp
    JOIN users u ON tp.user_id = u.id
    JOIN tracks t ON tp.track_id = t.id
    LEFT JOIN albums a ON t.album_id = a.id
    JOIN users ar ON t.artist_id = ar.id
    WHERE t.status = 'approved' ${whereSql}
    ORDER BY tp.created_at DESC
    LIMIT ?
  `, [...params, limit]);
}

async function getTrackReleaseRows(whereSql: string, params: any[], limit: number) {
  return getAll<any>(`
    SELECT
      t.id as track_id, t.title as track_title, t.duration, t.file_path, t.cover_url as track_cover,
      t.is_explicit, t.is_premium, t.album_id, t.created_at,
      a.title as album_title, a.cover_url as album_cover, a.type as album_type, a.created_at as album_created_at,
      ar.id as artist_id, ar.username as artist_name, ar.avatar_url as artist_avatar_url,
      ar.is_verified as artist_is_verified, ar.is_premium as artist_is_premium, ar.created_at as artist_created_at
    FROM tracks t
    JOIN users ar ON t.artist_id = ar.id
    LEFT JOIN albums a ON t.album_id = a.id
    WHERE t.status = 'approved' ${whereSql}
    ORDER BY t.created_at DESC
    LIMIT ?
  `, [...params, limit]);
}

async function getAlbumReleaseRows(whereSql: string, params: any[], limit: number) {
  return getAll<any>(`
    SELECT
      a.id as album_id, a.title as album_title, a.cover_url as album_cover, a.release_year,
      a.type as album_type, a.created_at,
      ar.id as artist_id, ar.username as artist_name, ar.avatar_url as artist_avatar_url,
      ar.is_verified as artist_is_verified, ar.is_premium as artist_is_premium, ar.created_at as artist_created_at
    FROM albums a
    JOIN users ar ON a.artist_id = ar.id
    WHERE a.status = 'approved' ${whereSql}
    ORDER BY a.created_at DESC
    LIMIT ?
  `, [...params, limit]);
}

function sortByCreatedAtDesc(items: any[]) {
  return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const listenRows = await getListenRows(
      `AND tp.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)`,
      [userId],
      40,
    );
    const trackRows = await getTrackReleaseRows(
      `AND t.artist_id IN (SELECT following_id FROM follows WHERE follower_id = ?)`,
      [userId],
      40,
    );
    const albumRows = await getAlbumReleaseRows(
      `AND a.artist_id IN (SELECT following_id FROM follows WHERE follower_id = ?)`,
      [userId],
      40,
    );

    const listenItems = listenRows.map((row) => ({
      id: Number(`1${row.id}`),
      type: 'listen',
      user: mapUser(row),
      track: mapTrack(row),
      album: row.album_id ? mapAlbum({ ...row, album_id: row.album_id, album_title: row.album_title, album_cover: row.album_cover, album_type: row.album_type, created_at: row.album_created_at || row.created_at }) : null,
      created_at: row.created_at,
      audiences: ['following'] satisfies Audience[],
    }));

    const trackItems = trackRows.map((row) => ({
      id: Number(`2${row.track_id}`),
      type: 'release_track',
      user: mapArtist(row),
      artist: mapArtist(row),
      track: mapTrack(row),
      album: row.album_id ? mapAlbum({ ...row, album_id: row.album_id, album_title: row.album_title, album_cover: row.album_cover, album_type: row.album_type, created_at: row.album_created_at || row.created_at }) : null,
      created_at: row.created_at,
      audiences: ['artists'] satisfies Audience[],
    }));

    const albumItems = albumRows.map((row) => ({
      id: Number(`3${row.album_id}`),
      type: 'release_album',
      user: mapArtist(row),
      artist: mapArtist(row),
      album: mapAlbum(row),
      created_at: row.created_at,
      audiences: ['artists'] satisfies Audience[],
    }));

    res.json(sortByCreatedAtDesc([...listenItems, ...trackItems, ...albumItems]).slice(0, 60));
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/global', async (_req, res: Response) => {
  try {
    const listenRows = await getListenRows('', [], 25);
    const trackRows = await getTrackReleaseRows('', [], 25);
    const albumRows = await getAlbumReleaseRows('', [], 25);

    const listenItems = listenRows.map((row) => ({
      id: Number(`1${row.id}`),
      type: 'listen',
      user: mapUser(row),
      track: mapTrack(row),
      album: row.album_id ? mapAlbum({ ...row, album_id: row.album_id, album_title: row.album_title, album_cover: row.album_cover, album_type: row.album_type, created_at: row.album_created_at || row.created_at }) : null,
      created_at: row.created_at,
      audiences: ['all'] satisfies Audience[],
    }));

    const trackItems = trackRows.map((row) => ({
      id: Number(`2${row.track_id}`),
      type: 'release_track',
      user: mapArtist(row),
      artist: mapArtist(row),
      track: mapTrack(row),
      album: row.album_id ? mapAlbum({ ...row, album_id: row.album_id, album_title: row.album_title, album_cover: row.album_cover, album_type: row.album_type, created_at: row.album_created_at || row.created_at }) : null,
      created_at: row.created_at,
      audiences: ['all', 'artists'] satisfies Audience[],
    }));

    const albumItems = albumRows.map((row) => ({
      id: Number(`3${row.album_id}`),
      type: 'release_album',
      user: mapArtist(row),
      artist: mapArtist(row),
      album: mapAlbum(row),
      created_at: row.created_at,
      audiences: ['all', 'artists'] satisfies Audience[],
    }));

    res.json(sortByCreatedAtDesc([...listenItems, ...trackItems, ...albumItems]).slice(0, 60));
  } catch (error) {
    console.error('Get global feed error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
```

Expected: route compiles against existing `getAll`, `authenticateToken`, and `AuthRequest` exports.

- [ ] **Step 3: Mount the feed route in `backend/index.ts`**

Add this import next to the other route imports:

```ts
import feedRoutes from './routes/feed';
```

Add this mount after the following/friends routes and before transactions/history:

```ts
app.use('/api/feed', feedRoutes);
```

Expected: `/api/feed` and `/api/feed/global` are registered before the error handler.

- [ ] **Step 4: Expose artist_id and artist_name in `/api/tracks`**

In the `/api/tracks` SELECT in `backend/index.ts`, replace:

```ts
t.id, t.title, t.duration, t.file_path, t.cover_url, t.is_explicit, t.is_premium, t.status, t.created_at,
```

with:

```ts
t.id, t.title, t.artist_id, u.username as artist_name, t.duration, t.file_path, t.cover_url, t.is_explicit, t.is_premium, t.status, t.created_at,
```

Expected: `ArtistPage` can use both nested `track.artist` and legacy `track.artist_id`/`track.artist_name`.

- [ ] **Step 5: Run backend feed route assertions again**

Run:

```bash
node -e "const fs=require('fs'); const index=fs.readFileSync('backend/index.ts','utf8'); const failures=[]; if (!fs.existsSync('backend/routes/feed.ts')) failures.push('backend/routes/feed.ts missing'); if (!/import feedRoutes from '\.\/routes\/feed'/.test(index)) failures.push('feed route import missing'); if (!/app\.use\('\/api\/feed', feedRoutes\)/.test(index)) failures.push('feed route mount missing'); if (!/t\.artist_id,\s*u\.username as artist_name/.test(index)) failures.push('/api/tracks does not expose artist_id and artist_name'); if (failures.length) { console.error(failures.join('\n')); process.exit(1); } console.log('backend feed route assertions passed');"
```

Expected: PASS with `backend feed route assertions passed`.

- [ ] **Step 6: Build backend**

Run:

```bash
npm --prefix backend run build
```

Expected: TypeScript build succeeds. If it reports a type error about `satisfies Audience[]`, replace `satisfies Audience[]` with `as Audience[]` in `backend/routes/feed.ts` and rerun.

- [ ] **Step 7: Checkpoint diff**

Run:

```bash
git diff -- backend/index.ts backend/routes/feed.ts
```

Expected diff: one new feed route file, feed route import/mount in `backend/index.ts`, and added `artist_id`/`artist_name` fields in the `/api/tracks` SELECT.

Commit checkpoint only if commits are authorized:

```bash
git add backend/index.ts backend/routes/feed.ts
git commit -m "feat(feed): surface subscribed artist releases"
```

---

## Task 2: FeedPage release rendering

**Files:**
- Modify: `frontend/src/pages/FeedPage.tsx`

- [ ] **Step 1: Write a failing FeedPage assertion script**

Run from repo root before editing:

```bash
node -e "const fs=require('fs'); const src=fs.readFileSync('frontend/src/pages/FeedPage.tsx','utf8'); const failures=[]; if (!/release_track/.test(src)) failures.push('release_track support missing'); if (!/release_album/.test(src)) failures.push('release_album support missing'); if (/favoriteArtistsRes/.test(src)) failures.push('client still depends on favorite-artists feed filter'); if (!/fetch\('\/api\/feed', \{ headers \}\)/.test(src)) failures.push('authenticated feed does not fetch /api/feed directly'); if (failures.length) { console.error(failures.join('\n')); process.exit(1); } console.log('FeedPage release assertions passed');"
```

Expected: FAIL with missing release support and favorite-artists dependency.

- [ ] **Step 2: Expand feed item types**

Replace the current `FeedItem` interface with:

```tsx
interface FeedItem {
  id: number
  type: 'listen' | 'release_track' | 'release_album'
  user: UserType
  artist?: UserType
  track?: Track & { artist?: { id: number; username: string }; album?: { title: string; cover_url: string } }
  album?: Album & { artist?: { id: number; username: string } } | null
  created_at: string
  audiences?: FeedAudienceFilter[]
}
```

Delete the `FavoriteArtist` interface because the backend now owns subscribed-artist filtering.

Expected: feed items can represent listens, track releases, and album releases.

- [ ] **Step 3: Update activity icon/text helpers**

Replace `ActivityIcon` with:

```tsx
function ActivityIcon({ type }: { type: FeedItem['type'] }) {
  switch (type) {
    case 'listen': return <Play className="w-3 h-3 text-green-400" />
    case 'release_track': return <Music className="w-3 h-3 text-purple-300" />
    case 'release_album': return <Mic2 className="w-3 h-3 text-pink-300" />
    default: return null
  }
}
```

Replace `getActivityText` with:

```tsx
function getActivityText(type: FeedItem['type']): string {
  switch (type) {
    case 'listen': return 'слушал'
    case 'release_track': return 'выпустил трек'
    case 'release_album': return 'выпустил альбом'
    default: return ''
  }
}
```

Expected: release events have correct Russian labels.

- [ ] **Step 4: Simplify authenticated feed loading**

Inside `loadFeed`, replace the authenticated branch that fetches `globalFeedRes`, `followingRes`, `friendsRes`, and `favoriteArtistsRes` with:

```tsx
const headers = getAuthHeaders()
const res = await fetch('/api/feed', { headers })
if (res.ok) {
  const data: FeedItem[] = await res.json()
  setFeed(data.map(item => ({ ...item, audiences: item.audiences?.length ? item.audiences : ['all'] })))
}
```

Keep the unauthenticated `/api/feed/global` branch and the fallback `catch` block.

Expected: frontend no longer reconstructs subscribed artists from `/api/user/me/favorite-artists`.

- [ ] **Step 5: Make play handler safe for release_album events**

Replace `handlePlay` with:

```tsx
const handlePlay = (track?: Track) => {
  if (!track) return
  const queue = filteredFeed
    .map(f => f.track)
    .filter((item): item is Track => Boolean(item))

  player.setTrack(track)
  player.setQueue(queue)
  player.play()
}
```

Expected: album-only release events do not crash when clicked.

- [ ] **Step 6: Update feed card identity links**

In the feed card header, use this local value at the start of the `.map` callback body:

```tsx
const actor = item.artist || item.user
const actorTarget = actor.role === 'artist' ? `/artist/${actor.id}` : `/user/${actor.id}`
```

Then replace the avatar/profile links from `/user/${item.user.id}` and `item.user` to `actorTarget` and `actor`:

```tsx
<Link to={actorTarget} className="relative">
  <img
    src={actor.avatar_url ? `${actor.avatar_url}` : '/default-avatar.svg'}
    alt={actor.username}
    className="w-10 h-10 rounded-full object-cover"
  />
  <OnlineStatus isOnline={onlineStatus[actor.id]} size="sm" className="absolute bottom-0 right-0" />
</Link>
```

```tsx
<Link to={actorTarget} className="font-medium hover:underline">
  @{actor.username}
</Link>
{actor.is_verified && (
  <span className="text-xs text-purple-400">✓</span>
)}
```

Expected: artist release cards link to `/artist/:id`; listen cards keep linking to user pages unless the actor is an artist.

- [ ] **Step 7: Render track and album content conditionally**

Replace the media block that currently assumes `item.track` exists with:

```tsx
{item.track && (
  <div className="mt-3 p-3 rounded-lg bg-white/[0.03] flex items-center gap-3">
    <img
      src={item.track.cover_url || item.track.album?.cover_url || '/default-cover.svg'}
      alt={item.track.title}
      className="w-12 h-12 rounded object-cover"
    />
    <div className="flex-1 min-w-0">
      <Link to={`/track/${item.track.id}`} className="font-medium hover:underline truncate block">
        {item.track.title}
      </Link>
      <div className="text-sm text-white/40 truncate">
        {item.track.artist?.username || item.artist?.username || 'Артист'}
        {item.track.album?.title && ` • ${item.track.album.title}`}
      </div>
    </div>
    <button
      onClick={() => handlePlay(item.track)}
      className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
      aria-label="Воспроизвести трек"
    >
      <Play className="w-4 h-4" fill="currentColor" />
    </button>
  </div>
)}

{!item.track && item.album && (
  <Link to={`/album/${item.album.id}`} className="mt-3 p-3 rounded-lg bg-white/[0.03] flex items-center gap-3 transition hover:bg-white/[0.06]">
    <img
      src={item.album.cover_url || '/default-cover.svg'}
      alt={item.album.title}
      className="w-12 h-12 rounded object-cover"
    />
    <div className="flex-1 min-w-0">
      <span className="font-medium truncate block">{item.album.title}</span>
      <div className="text-sm text-white/40 truncate">
        {item.album.artist?.username || item.artist?.username || 'Артист'} • {item.album.type || 'album'}
      </div>
    </div>
  </Link>
)}
```

Expected: release_album events show album cards and do not render a play button unless a track exists.

- [ ] **Step 8: Run FeedPage assertions again**

Run:

```bash
node -e "const fs=require('fs'); const src=fs.readFileSync('frontend/src/pages/FeedPage.tsx','utf8'); const failures=[]; if (!/release_track/.test(src)) failures.push('release_track support missing'); if (!/release_album/.test(src)) failures.push('release_album support missing'); if (/favoriteArtistsRes/.test(src)) failures.push('client still depends on favorite-artists feed filter'); if (!/fetch\('\/api\/feed', \{ headers \}\)/.test(src)) failures.push('authenticated feed does not fetch /api/feed directly'); if (failures.length) { console.error(failures.join('\n')); process.exit(1); } console.log('FeedPage release assertions passed');"
```

Expected: PASS with `FeedPage release assertions passed`.

- [ ] **Step 9: Build frontend**

Run:

```bash
npm --prefix frontend run build
```

Expected: TypeScript and Vite build succeed. Existing chunk-size/colorExtractor warnings are acceptable.

- [ ] **Step 10: Checkpoint diff**

Run:

```bash
git diff -- frontend/src/pages/FeedPage.tsx
```

Expected diff: new feed event types, direct `/api/feed` authenticated loading, release labels/icons, conditional track/album rendering.

Commit checkpoint only if commits are authorized:

```bash
git add frontend/src/pages/FeedPage.tsx
git commit -m "feat(feed): render subscribed artist releases"
```

---

## Task 3: ArtistPage subscription labels and player artist mapping

**Files:**
- Modify: `frontend/src/pages/ArtistPage.tsx`

- [ ] **Step 1: Write a failing ArtistPage assertion script**

Run from repo root before editing:

```bash
node -e "const fs=require('fs'); const src=fs.readFileSync('frontend/src/pages/ArtistPage.tsx','utf8'); const failures=[]; if (/В любим/.test(src)) failures.push('favorite wording still present'); if (!/Подписаться/.test(src) || !/Подписан/.test(src)) failures.push('subscription wording missing'); if (!/mapArtistTrackForPlayer/.test(src)) failures.push('central ArtistPage track mapper missing'); if (!/track\.artist\?\.id/.test(src)) failures.push('mapper does not read nested track.artist'); if (failures.length) { console.error(failures.join('\n')); process.exit(1); } console.log('ArtistPage assertions passed');"
```

Expected: FAIL with favorite wording and mapper missing.

- [ ] **Step 2: Extend the local Track interface**

In `ArtistPage.tsx`, replace the local `Track` interface with:

```tsx
interface Track {
  id: number
  title: string
  artist_id?: number
  artist_name?: string
  artist?: {
    id: number
    username: string
    email?: string
    role?: 'user' | 'artist' | 'moderator' | 'admin'
    avatar_url?: string | null
    is_verified?: boolean
    is_premium?: boolean
    created_at?: string
  } | null
  duration: number
  file_path: string
  cover_url: string | null
  created_at: string
}
```

Expected: the page can represent the actual `/api/tracks?artist_id=` payload with nested `artist`.

- [ ] **Step 3: Add a central player mapper**

After `handleArtistLikeToggle`, insert:

```tsx
const mapArtistTrackForPlayer = (track: Track) => {
  const artistId = track.artist?.id ?? track.artist_id ?? artist?.id ?? Number(id)
  const artistName = track.artist?.username ?? track.artist_name ?? artist?.username ?? 'Артист'

  return {
    id: track.id,
    title: track.title,
    artist_id: artistId,
    artist: {
      id: artistId,
      username: artistName,
      email: track.artist?.email || '',
      role: (track.artist?.role || 'artist') as 'artist',
      avatar_url: track.artist?.avatar_url || artist?.avatar_url || undefined,
      is_verified: Boolean(track.artist?.is_verified ?? artist?.is_verified),
      is_premium: Boolean(track.artist?.is_premium ?? artist?.is_premium),
      created_at: track.artist?.created_at || artist?.created_at || '',
    },
    duration: track.duration,
    file_path: track.file_path,
    cover_url: track.cover_url ?? undefined,
    is_explicit: false,
    is_premium: false,
    status: 'approved' as const,
    created_at: track.created_at,
  }
}
```

Expected: player receives a valid positive artist id and username even if `artist_name` is absent.

- [ ] **Step 4: Use mapper in single-track playback**

Replace `handlePlayTrack` with:

```tsx
const handlePlayTrack = (track: Track) => {
  player.setTrack(mapArtistTrackForPlayer(track), true, null)
}
```

Expected: expanded player can link author to `/artist/:id` after starting a track from ArtistPage cards.

- [ ] **Step 5: Use mapper in play-all queue**

Inside `handlePlayAll`, replace the current `const trackList = tracks.map(track => ({ ... }))` object construction with:

```tsx
const trackList = tracks.map(mapArtistTrackForPlayer)
```

Keep the existing active-track toggle logic and `player.setQueue(trackList, true, null)`.

Expected: all ArtistPage queue tracks have the same valid artist metadata.

- [ ] **Step 6: Rename follow UI text and toasts**

In `handleArtistLikeToggle`, replace the toast detail message line with:

```tsx
message: isFollowing ? 'Вы отписались от артиста' : 'Вы подписались на артиста',
```

In the hero follow button, replace:

```tsx
{isFollowing ? 'В любимых' : 'В любимые'}
```

with:

```tsx
{isFollowing ? 'Подписан' : 'Подписаться'}
```

Expected: no “В любимых/В любимые/любимые” wording remains on concrete ArtistPage subscription action.

- [ ] **Step 7: Update track row artist fallback display**

Replace the track row subtitle:

```tsx
<p className="mt-0.5 truncate text-xs text-white/34">{track.artist_name}</p>
```

with:

```tsx
<p className="mt-0.5 truncate text-xs text-white/34">{track.artist?.username ?? track.artist_name ?? artist.username}</p>
```

Expected: ArtistPage rows do not show empty artist names when backend returns nested artist only.

- [ ] **Step 8: Run ArtistPage assertions again**

Run:

```bash
node -e "const fs=require('fs'); const src=fs.readFileSync('frontend/src/pages/ArtistPage.tsx','utf8'); const failures=[]; if (/В любим/.test(src)) failures.push('favorite wording still present'); if (!/Подписаться/.test(src) || !/Подписан/.test(src)) failures.push('subscription wording missing'); if (!/mapArtistTrackForPlayer/.test(src)) failures.push('central ArtistPage track mapper missing'); if (!/track\.artist\?\.id/.test(src)) failures.push('mapper does not read nested track.artist'); if (failures.length) { console.error(failures.join('\n')); process.exit(1); } console.log('ArtistPage assertions passed');"
```

Expected: PASS with `ArtistPage assertions passed`.

- [ ] **Step 9: Build frontend**

Run:

```bash
npm --prefix frontend run build
```

Expected: build succeeds.

- [ ] **Step 10: Checkpoint diff**

Run:

```bash
git diff -- frontend/src/pages/ArtistPage.tsx
```

Expected diff: Track interface supports nested artist, mapper added, play handlers use mapper, follow text/toasts changed to subscription wording.

Commit checkpoint only if commits are authorized:

```bash
git add frontend/src/pages/ArtistPage.tsx
git commit -m "fix(artist): map subscribed artist playback metadata"
```

---

## Task 4: Restore visualizer ring deformation while preserving smooth activation

**Files:**
- Modify: `frontend/src/components/AudioVisualizer.tsx`
- Modify: `frontend/src/components/MiniAudioVisualizer.tsx`

- [ ] **Step 1: Write a failing visualizer assertion script**

Run from repo root before editing:

```bash
node -e "const fs=require('fs'); const main=fs.readFileSync('frontend/src/components/AudioVisualizer.tsx','utf8'); const mini=fs.readFileSync('frontend/src/components/MiniAudioVisualizer.tsx','utf8'); const failures=[]; if (!/const geometryBand/.test(main)) failures.push('main geometryBand missing'); if (!/const geometryVoice/.test(main)) failures.push('main geometryVoice missing'); if (/raw \*= activeResponse/.test(main) || /voiceRaw \*= activeResponse/.test(main)) failures.push('main still double-gates raw FFT bands'); if (!/const geometryBand/.test(mini)) failures.push('mini geometryBand missing'); if (!/const geometryVoice/.test(mini)) failures.push('mini geometryVoice missing'); if (/raw \*= activeResponse/.test(mini) || /voiceRaw \*= activeResponse/.test(mini)) failures.push('mini still double-gates raw FFT bands'); if (failures.length) { console.error(failures.join('\n')); process.exit(1); } console.log('Visualizer deformation assertions passed');"
```

Expected: FAIL with missing `geometryBand` / `geometryVoice` and current raw FFT double-gating.

- [ ] **Step 2: Remove raw FFT double-gating in main visualizer**

In `AudioVisualizer.tsx`, find the per-ring sampling branch:

```tsx
} else {
  raw *= activeResponse
  voiceRaw *= activeResponse
}
```

Replace it with:

```tsx
} else {
  const responseFloor = 0.32 + activeResponse * 0.68
  raw *= responseFloor
  voiceRaw *= responseFloor
}
```

Expected: the envelope still smooths sudden starts, but does not multiply low FFT levels down twice.

- [ ] **Step 3: Add explicit main geometry values**

In `AudioVisualizer.tsx`, inside the ring draw loop after `const beat = ringBeatEnv[i] * easedEnvelope`, replace the current `boostedBand`/`boostedVoice` block with:

```tsx
const geometryBand = clamp(band * 1.65, 0, 1)
const geometryVoice = clamp(voiceBand * 1.9, 0, 1)
const envelopeFloor = idle ? 0 : 0.28 + activeResponse * 0.72
const boostedBand = geometryBand * envelopeFloor
const boostedVoice = geometryVoice * envelopeFloor
const bassKick = clamp(smoothBass * 2.4 + beat * 0.75, 0, 1)
const motionLift = idle ? 0 : clamp(activeResponse * 0.28 + geometryBand * 0.42 + geometryVoice * 0.5 + bassKick * 0.34, 0, 1)
const shapeKick = idle ? 0 : clamp(geometryVoice * 0.68 + geometryBand * 0.38 + bassKick * 0.46 + beat * 0.35, 0, 1)
const vocalBias = clamp(boostedVoice * 0.58 + boostedBand * 0.24 + bassKick * 0.18, 0, 1)
```

Expected: geometry is driven by smoothed FFT bands with a non-zero active floor, while colors can still transition independently.

- [ ] **Step 4: Make main deformation formulas use geometry values**

In the same loop, make sure the formulas include these exact signals:

```tsx
const swing = swingBase + geometryBand * 0.24 + geometryVoice * 0.48 + bassKick * 0.22 + beat * 0.16
const growSwing = growSwingBase + geometryBand * 0.28 + geometryVoice * 0.38 + bassKick * 0.28 + beat * 0.2
```

Keep the existing `aspect`, `grow`, `jitter`, `radialDrift`, and Bezier path logic, but replace `boostedBand`/`boostedVoice` in shape-amplitude formulas with `geometryBand`/`geometryVoice` where the formula controls size, aspect, handle length, or asymmetry.

Expected: active playback visibly changes ring shape even when FFT levels are moderate.

- [ ] **Step 5: Remove raw FFT double-gating in mini visualizer**

In `MiniAudioVisualizer.tsx`, find:

```tsx
} else {
  raw *= activeResponse
  voiceRaw *= activeResponse
}
```

Replace with:

```tsx
} else {
  const responseFloor = 0.35 + activeResponse * 0.65
  raw *= responseFloor
  voiceRaw *= responseFloor
}
```

Expected: mini visualizer keeps smooth activation without flattening geometry.

- [ ] **Step 6: Add explicit mini geometry values**

In `MiniAudioVisualizer.tsx`, inside the ring loop after `const voiceBand = ringVoiceBands[i]`, replace current `boostedBand`/`boostedVoice` block with:

```tsx
const geometryBand = Math.max(0, Math.min(1, band * 1.6))
const geometryVoice = Math.max(0, Math.min(1, voiceBand * 1.85))
const envelopeFloor = idle ? 0 : 0.3 + activeResponse * 0.7
const boostedBand = geometryBand * envelopeFloor
const boostedVoice = geometryVoice * envelopeFloor
const bassKick = Math.max(0, Math.min(1, smoothBass * 2.25))
const motionLift = idle ? 0 : Math.max(0, Math.min(1, activeResponse * 0.28 + geometryBand * 0.42 + geometryVoice * 0.5 + bassKick * 0.34))
const shapeKick = idle ? 0 : Math.max(0, Math.min(1, geometryVoice * 0.68 + geometryBand * 0.38 + bassKick * 0.46))
const vocalBias = Math.min(1, boostedVoice * 0.58 + boostedBand * 0.24 + bassKick * 0.18)
```

Expected: mini geometry uses band values before envelope scaling for visible deformation.

- [ ] **Step 7: Make mini deformation formulas use geometry values**

In the same mini loop, make sure these formulas use geometry values:

```tsx
const swing = swingBase + geometryBand * 0.22 + geometryVoice * 0.42 + bassKick * 0.2
const growSwing = growSwingBase + geometryBand * 0.24 + geometryVoice * 0.34 + bassKick * 0.24
```

Expected: mini ellipses visibly breathe/deform with active music, not only recolor.

- [ ] **Step 8: Run visualizer assertions again**

Run:

```bash
node -e "const fs=require('fs'); const main=fs.readFileSync('frontend/src/components/AudioVisualizer.tsx','utf8'); const mini=fs.readFileSync('frontend/src/components/MiniAudioVisualizer.tsx','utf8'); const failures=[]; if (!/const geometryBand/.test(main)) failures.push('main geometryBand missing'); if (!/const geometryVoice/.test(main)) failures.push('main geometryVoice missing'); if (/raw \*= activeResponse/.test(main) || /voiceRaw \*= activeResponse/.test(main)) failures.push('main still double-gates raw FFT bands'); if (!/const geometryBand/.test(mini)) failures.push('mini geometryBand missing'); if (!/const geometryVoice/.test(mini)) failures.push('mini geometryVoice missing'); if (/raw \*= activeResponse/.test(mini) || /voiceRaw \*= activeResponse/.test(mini)) failures.push('mini still double-gates raw FFT bands'); if (failures.length) { console.error(failures.join('\n')); process.exit(1); } console.log('Visualizer deformation assertions passed');"
```

Expected: PASS with `Visualizer deformation assertions passed`.

- [ ] **Step 9: Build frontend**

Run:

```bash
npm --prefix frontend run build
```

Expected: build succeeds.

- [ ] **Step 10: Checkpoint diff**

Run:

```bash
git diff -- frontend/src/components/AudioVisualizer.tsx frontend/src/components/MiniAudioVisualizer.tsx
```

Expected diff: raw FFT response floor replaces direct activeResponse multiplication, `geometryBand`/`geometryVoice` added, deformation formulas use geometry values.

Commit checkpoint only if commits are authorized:

```bash
git add frontend/src/components/AudioVisualizer.tsx frontend/src/components/MiniAudioVisualizer.tsx
git commit -m "fix(visualizer): restore audio-driven ring deformation"
```

---

## Task 5: Final verification and manual checks

**Files:**
- Verify: `backend/index.ts`
- Verify: `backend/routes/feed.ts`
- Verify: `frontend/src/pages/FeedPage.tsx`
- Verify: `frontend/src/pages/ArtistPage.tsx`
- Verify: `frontend/src/components/AudioVisualizer.tsx`
- Verify: `frontend/src/components/MiniAudioVisualizer.tsx`

- [ ] **Step 1: Run all assertion scripts**

Run backend assertions:

```bash
node -e "const fs=require('fs'); const index=fs.readFileSync('backend/index.ts','utf8'); const failures=[]; if (!fs.existsSync('backend/routes/feed.ts')) failures.push('backend/routes/feed.ts missing'); if (!/import feedRoutes from '\.\/routes\/feed'/.test(index)) failures.push('feed route import missing'); if (!/app\.use\('\/api\/feed', feedRoutes\)/.test(index)) failures.push('feed route mount missing'); if (!/t\.artist_id,\s*u\.username as artist_name/.test(index)) failures.push('/api/tracks does not expose artist_id and artist_name'); if (failures.length) { console.error(failures.join('\n')); process.exit(1); } console.log('backend feed route assertions passed');"
```

Run FeedPage assertions:

```bash
node -e "const fs=require('fs'); const src=fs.readFileSync('frontend/src/pages/FeedPage.tsx','utf8'); const failures=[]; if (!/release_track/.test(src)) failures.push('release_track support missing'); if (!/release_album/.test(src)) failures.push('release_album support missing'); if (/favoriteArtistsRes/.test(src)) failures.push('client still depends on favorite-artists feed filter'); if (!/fetch\('\/api\/feed', \{ headers \}\)/.test(src)) failures.push('authenticated feed does not fetch /api/feed directly'); if (failures.length) { console.error(failures.join('\n')); process.exit(1); } console.log('FeedPage release assertions passed');"
```

Run ArtistPage assertions:

```bash
node -e "const fs=require('fs'); const src=fs.readFileSync('frontend/src/pages/ArtistPage.tsx','utf8'); const failures=[]; if (/В любим/.test(src)) failures.push('favorite wording still present'); if (!/Подписаться/.test(src) || !/Подписан/.test(src)) failures.push('subscription wording missing'); if (!/mapArtistTrackForPlayer/.test(src)) failures.push('central ArtistPage track mapper missing'); if (!/track\.artist\?\.id/.test(src)) failures.push('mapper does not read nested track.artist'); if (failures.length) { console.error(failures.join('\n')); process.exit(1); } console.log('ArtistPage assertions passed');"
```

Run visualizer assertions:

```bash
node -e "const fs=require('fs'); const main=fs.readFileSync('frontend/src/components/AudioVisualizer.tsx','utf8'); const mini=fs.readFileSync('frontend/src/components/MiniAudioVisualizer.tsx','utf8'); const failures=[]; if (!/const geometryBand/.test(main)) failures.push('main geometryBand missing'); if (!/const geometryVoice/.test(main)) failures.push('main geometryVoice missing'); if (/raw \*= activeResponse/.test(main) || /voiceRaw \*= activeResponse/.test(main)) failures.push('main still double-gates raw FFT bands'); if (!/const geometryBand/.test(mini)) failures.push('mini geometryBand missing'); if (!/const geometryVoice/.test(mini)) failures.push('mini geometryVoice missing'); if (/raw \*= activeResponse/.test(mini) || /voiceRaw \*= activeResponse/.test(mini)) failures.push('mini still double-gates raw FFT bands'); if (failures.length) { console.error(failures.join('\n')); process.exit(1); } console.log('Visualizer deformation assertions passed');"
```

Expected: all four scripts pass.

- [ ] **Step 2: Run backend build**

Run:

```bash
npm --prefix backend run build
```

Expected: TypeScript build succeeds.

- [ ] **Step 3: Run frontend build**

Run:

```bash
npm --prefix frontend run build
```

Expected: TypeScript and Vite build succeed. Existing Vite warnings about `colorExtractor.ts` chunking and large JS chunks are acceptable.

- [ ] **Step 4: Manual browser check: ArtistPage subscription**

Run dev servers if needed:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

In browser:
1. Open an artist page `/artist/:id` while authenticated.
2. Confirm the button says `Подписаться` when not followed.
3. Click it and confirm the toast says `Вы подписались на артиста` and button changes to `Подписан`.
4. Click again and confirm the toast says `Вы отписались от артиста` and button changes back to `Подписаться`.

Expected: behavior uses the existing follow API but all user-facing text says subscription.

- [ ] **Step 5: Manual browser check: Player artist link**

In browser:
1. Open `/artist/:id`.
2. Start a track from the artist track card.
3. Open the expanded player.
4. Confirm artist text shows the real artist username, not `Артист`.
5. Click the artist text.

Expected: it navigates to `/artist/:id`, collapses the expanded player, and playback continues.

- [ ] **Step 6: Manual browser check: Feed releases**

In browser:
1. Follow an artist with approved tracks and albums.
2. Open `/feed` while authenticated.
3. Use the `Артисты` filter.
4. Confirm new track events show `выпустил трек` with a playable track card.
5. Confirm new album events show `выпустил альбом` with a link to `/album/:id`.

Expected: subscribed artist tracks and albums appear in the feed.

- [ ] **Step 7: Manual browser check: Visualizer deformation**

In browser:
1. Open the homepage.
2. Start a track or Miyu Wave.
3. Watch the main visualizer for 10-15 seconds.
4. Navigate away so the mini visualizer appears and watch it for 10-15 seconds.

Expected: active state changes both color and ring geometry/deformation. Idle-to-active and active-to-idle transitions remain smooth.

- [ ] **Step 8: Review final diff**

Run:

```bash
git diff -- backend/index.ts backend/routes/feed.ts frontend/src/pages/FeedPage.tsx frontend/src/pages/ArtistPage.tsx frontend/src/components/AudioVisualizer.tsx frontend/src/components/MiniAudioVisualizer.tsx
```

Expected: diff is limited to the approved scope. Do not include unrelated local files like `database/miyu.db`, `.claude/worktrees/`, `.superpowers/`, or `docs/superpowers/plans/` unless explicitly instructed.

Commit final implementation only if commits are authorized:

```bash
git add backend/index.ts backend/routes/feed.ts frontend/src/pages/FeedPage.tsx frontend/src/pages/ArtistPage.tsx frontend/src/components/AudioVisualizer.tsx frontend/src/components/MiniAudioVisualizer.tsx
git commit -m "feat(feed): add artist subscription releases"
```

---

## Self-review

- **Spec coverage:** ArtistPage subscription wording is covered in Task 3. Subscribed artist track and album feed is covered in Tasks 1 and 2. Player fallback “Артист” fix is covered in Task 3 and backend `artist_id`/`artist_name` normalization in Task 1. Visualizer deformation restoration is covered in Task 4.
- **Placeholder scan:** The plan contains no `TBD`, `TODO`, “similar to”, or undefined helper references. All new helpers are defined in their task code blocks.
- **Type consistency:** Feed event types are consistently `listen | release_track | release_album`. Audience values are consistently `all | friends | following | artists`. ArtistPage mapper uses the local extended `Track` type and returns the player-compatible object shape already used in the project.
