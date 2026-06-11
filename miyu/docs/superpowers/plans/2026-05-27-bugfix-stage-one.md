# Bugfix Stage One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the first stage of Miyu UX bugs: playlist cover text wrapping, logo glow timing, concert zone checkout, expanded-player track navigation, and clip navigation.

**Architecture:** Keep changes targeted in existing React pages/components. `ConcertPage` remains responsible for zone selection and checkout state, `CheckoutPage` displays the submitted ticket items, and `ExpandedPlayer` computes track/video navigation from the current player state without changing playback.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, React Router, existing `/api` endpoints.

---

## File Structure

- Modify: `frontend/src/pages/PlaylistsPage.tsx`
  - Make the playlist title overlay always readable and allow two-line wrapping inside the cover.
- Modify: `frontend/src/components/ServiceLogo.tsx`
  - Move glow into an independent absolute layer and animate it with the logo reveal.
- Modify: `frontend/src/pages/ConcertPage.tsx`
  - Fix zone click behavior, unavailable-zone feedback, checkout item metadata, and buy-button states.
- Modify: `frontend/src/pages/CheckoutPage.tsx`
  - Display selected zone names in the ticket checkout order.
- Modify: `frontend/src/components/ExpandedPlayer.tsx`
  - Add track-title link and conditional clip button.
- Verification only: `frontend/package.json`
  - Use existing `npm run build` and `npm run lint` scripts.

No new files are needed.

---

### Task 1: Playlist cover title wrapping

**Files:**
- Modify: `frontend/src/pages/PlaylistsPage.tsx:120-123`

- [ ] **Step 1: Inspect the current overlay**

Read `frontend/src/pages/PlaylistsPage.tsx` and confirm the current playlist card has:

```tsx
<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
<div className="absolute bottom-0 left-0 right-0 p-2">
  <p className="font-medium text-sm truncate text-white drop-shadow-lg">{playlist.title}</p>
</div>
```

Expected: the title uses `truncate`, so long names are forced into one line and can look broken on the cover.

- [ ] **Step 2: Replace the overlay with always-visible gradient and two-line wrapping**

Replace the block above with:

```tsx
<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-100 transition-opacity group-hover:from-black/85" />
<div className="absolute bottom-0 left-0 right-0 p-2.5">
  <p className="line-clamp-2 break-words text-sm font-medium leading-snug text-white drop-shadow-lg">
    {playlist.title}
  </p>
</div>
```

Expected: long playlist names wrap to two lines and stay inside the square cover.

- [ ] **Step 3: Check TypeScript/Tailwind compatibility**

Run:

```bash
cd frontend && npm run build
```

Expected: build reaches Vite output or shows only unrelated pre-existing errors. If Tailwind reports `line-clamp-2` unavailable, replace it with:

```tsx
<p
  className="break-words text-sm font-medium leading-snug text-white drop-shadow-lg"
  style={{
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  }}
>
  {playlist.title}
</p>
```

- [ ] **Step 4: Commit this task**

```bash
git add frontend/src/pages/PlaylistsPage.tsx
git commit -m "fix: keep playlist titles inside covers"
```

---

### Task 2: Logo reveal glow timing

**Files:**
- Modify: `frontend/src/components/ServiceLogo.tsx:44-78`
- Modify: `frontend/src/components/ServiceLogo.tsx:85-151`

- [ ] **Step 1: Identify the masked logo animation**

Confirm `ServiceLogo.tsx` has `.miyu-logo-reveal` applying the radial mask to the same element that contains the SVG.

Expected: glow currently depends on SVG/drop-shadow and appears late or abruptly during reveal.

- [ ] **Step 2: Add independent glow keyframes**

Inside the existing `<style>{` block, after `@keyframes miyu-logo-center-reveal`, add:

```css
@keyframes miyu-logo-glow-reveal {
  0% {
    opacity: 0.18;
    transform: scale(0.82) rotate(0deg);
    filter: blur(12px);
  }
  28% {
    opacity: 0.58;
    transform: scale(1.08) rotate(90deg);
    filter: blur(14px);
  }
  58% {
    opacity: 0.42;
    transform: scale(1.18) rotate(180deg);
    filter: blur(18px);
  }
  100% {
    opacity: 0;
    transform: scale(1.34) rotate(360deg);
    filter: blur(22px);
  }
}
```

Expected: glow has opacity from the first frame and fades smoothly instead of popping in late.

- [ ] **Step 3: Add a glow animation class**

After `.miyu-logo-reveal`, add:

```css
.miyu-logo-glow-reveal {
  animation: miyu-logo-glow-reveal 4.8s cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: center;
  will-change: opacity, transform, filter;
}
```

Expected: glow animation is separate from the masked SVG animation.

- [ ] **Step 4: Split the animated SVG layer from the glow layer**

Replace the icon wrapper content:

```tsx
<span
  className={`relative flex items-center justify-center rounded-xl overflow-visible ${isRevealing ? 'miyu-logo-reveal' : ''}`}
  style={{ width: iconSize, height: iconSize }}
>
  <svg ...>
    ...
  </svg>
</span>
```

with this structure, keeping the existing `<svg>` content unchanged inside the inner span:

```tsx
<span
  className="relative flex items-center justify-center rounded-xl overflow-visible"
  style={{ width: iconSize, height: iconSize }}
>
  <span
    aria-hidden="true"
    className={`pointer-events-none absolute inset-[-8px] rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.42)_0%,rgba(168,85,247,0.32)_38%,rgba(56,189,248,0.18)_62%,transparent_78%)] opacity-0 ${isRevealing ? 'miyu-logo-glow-reveal' : ''}`}
  />
  <span className={isRevealing ? 'miyu-logo-reveal' : ''}>
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="-6 -6 76 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="overflow-visible drop-shadow-[0_0_18px_rgba(168,85,247,0.32)]"
    >
      ...existing defs, circles, and loop groups...
    </svg>
  </span>
</span>
```

Expected: only the SVG is masked; the glow is not masked and starts immediately.

- [ ] **Step 5: Build-check the component**

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript accepts the nested spans and CSS.

- [ ] **Step 6: Commit this task**

```bash
git add frontend/src/components/ServiceLogo.tsx
git commit -m "fix: sync logo glow reveal"
```

---

### Task 3: Concert zone selection and checkout handoff

**Files:**
- Modify: `frontend/src/pages/ConcertPage.tsx:11-121`
- Modify: `frontend/src/pages/ConcertPage.tsx:189-312`
- Modify: `frontend/src/pages/CheckoutPage.tsx:14-19`
- Modify: `frontend/src/pages/CheckoutPage.tsx:121-125`

- [ ] **Step 1: Extend checkout item types with zone fields**

In `frontend/src/pages/CheckoutPage.tsx`, change `TicketCheckoutItem` to:

```ts
interface TicketCheckoutItem {
  ticketTypeId: number
  quantity: number
  name: string
  price: number
  zoneId?: string
  zoneName?: string
}
```

Expected: checkout can display zone metadata passed by the concert page.

- [ ] **Step 2: Display zone name in the order block**

Replace the item row in `CheckoutPage.tsx`:

```tsx
<div key={item.ticketTypeId} className="flex justify-between gap-4 text-sm">
  <span>{item.name} x{item.quantity}</span>
  <span>{(item.price * item.quantity).toLocaleString('ru-RU')} ₽</span>
</div>
```

with:

```tsx
<div key={item.ticketTypeId} className="flex justify-between gap-4 text-sm">
  <span className="min-w-0">
    <span className="block truncate">{item.name} x{item.quantity}</span>
    {item.zoneName && <span className="block text-xs text-white/40">Зона: {item.zoneName}</span>}
  </span>
  <span className="shrink-0">{(item.price * item.quantity).toLocaleString('ru-RU')} ₽</span>
</div>
```

Expected: checkout clearly shows which zone was selected.

- [ ] **Step 3: Add zone feedback helper state**

In `ConcertPage.tsx`, keep the existing state and add no new broad state. Reuse the existing `purchaseError` for zone messages.

Confirm these existing lines are present:

```ts
const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
const [purchaseError, setPurchaseError] = useState<string | null>(null);
```

Expected: unavailable zone feedback will use the existing toast UI at the bottom.

- [ ] **Step 4: Replace `handleZoneClick` with validated behavior**

Replace the current function:

```ts
const handleZoneClick = (zoneId: string) => {
  setSelectedZoneId(zoneId);
  // Find ticket for this zone and scroll to it
  const ticket = concert?.tickets.find(t => t.zone_id === zoneId);
  if (ticket) {
    // Auto-select this zone if not already selected
    if (!selectedTickets[ticket.id]) {
      updateTicketQty(ticket.id, 1);
    }
  }
};
```

with:

```ts
const handleZoneClick = (zoneId: string) => {
  if (!concert || !zoneId) return;

  setSelectedZoneId(zoneId);
  setPurchaseError(null);

  const ticket = concert.tickets.find((ticket) => ticket.zone_id === zoneId);
  const zone = venuePlan?.zones.find((item) => item.id === zoneId);
  const zoneLabel = zone?.label || zone?.name || 'Эта зона';

  if (!ticket) {
    setPurchaseError(`${zoneLabel}: билеты для этой зоны пока недоступны`);
    return;
  }

  if (ticket.available <= 0) {
    setPurchaseError(`${zoneLabel}: билеты распроданы`);
    return;
  }

  if (!selectedTickets[ticket.id]) {
    updateTicketQty(ticket.id, 1);
  }
};
```

Expected: clicking a zone either selects one ticket or shows a clear message.

- [ ] **Step 5: Include zone data in checkout items**

In `handleBuyTickets`, replace the `items` mapping:

```ts
.map((ticket) => ({
  ticketTypeId: ticket.id,
  quantity: selectedTickets[ticket.id],
  name: ticket.name,
  price: ticket.price,
}));
```

with:

```ts
.map((ticket) => {
  const zone = venuePlan?.zones.find((item) => item.id === ticket.zone_id);

  return {
    ticketTypeId: ticket.id,
    quantity: selectedTickets[ticket.id],
    name: ticket.name,
    price: ticket.price,
    zoneId: ticket.zone_id,
    zoneName: zone?.label || zone?.name,
  };
});
```

Expected: checkout receives the selected zone name for display.

- [ ] **Step 6: Guard empty checkout before navigation**

Right after `items` is computed in `handleBuyTickets`, add:

```ts
if (items.length === 0 || totalPrice <= 0) {
  setPurchaseError('Выберите доступную зону и количество билетов');
  return;
}
```

Expected: the checkout page is not opened with an empty order.

- [ ] **Step 7: Make unavailable ticket cards non-selecting and clear**

In the ticket card map, replace:

```tsx
const zone = venuePlan?.zones.find(z => z.id === sector.zone_id);
const isSelected = selectedZoneId === sector.zone_id;
```

with:

```tsx
const zone = venuePlan?.zones.find(z => z.id === sector.zone_id);
const isSelected = selectedZoneId === sector.zone_id;
const isAvailable = sector.available > 0;
```

Then replace the card `className` expression:

```tsx
className={`p-4 rounded-xl transition cursor-pointer ${
  isSelected
    ? 'bg-purple-500/20 border-2 border-purple-500'
    : 'bg-white/[0.03] border-2 border-transparent hover:border-white/10'
}`}
```

with:

```tsx
className={`p-4 rounded-xl border-2 transition ${
  isSelected
    ? 'bg-purple-500/20 border-purple-500'
    : 'bg-white/[0.03] border-transparent hover:border-white/10'
} ${isAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
```

Expected: sold-out cards look disabled but can still be clicked to show the sold-out message through `handleZoneClick`.

- [ ] **Step 8: Keep quantity controls tied to available tickets**

Confirm the quantity controls are still wrapped by:

```tsx
{sector.available > 0 && (
  <div className="flex items-center justify-between">
    ...
  </div>
)}
```

Expected: sold-out zones do not expose plus/minus controls.

- [ ] **Step 9: Disable buy button unless the order is valid**

Replace the buy button disabled prop:

```tsx
disabled={isBuying}
```

with:

```tsx
disabled={isBuying || totalTickets === 0 || totalPrice <= 0}
```

Replace the button class disabled condition if needed so disabled opacity still applies:

```tsx
className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full font-medium text-base transition disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
```

Expected: user cannot proceed without selected tickets.

- [ ] **Step 10: Build-check concert checkout changes**

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript accepts `zone?.label || zone?.name`. If `VenuePlan` zone type does not expose `label`, use only `zone?.name` in both modified locations.

- [ ] **Step 11: Commit this task**

```bash
git add frontend/src/pages/ConcertPage.tsx frontend/src/pages/CheckoutPage.tsx
git commit -m "fix: connect concert zones to checkout"
```

---

### Task 4: Expanded player track-title navigation

**Files:**
- Modify: `frontend/src/components/ExpandedPlayer.tsx:198-216`
- Modify: `frontend/src/components/ExpandedPlayer.tsx:393-395`

- [ ] **Step 1: Add a track link target**

In `ExpandedPlayer.tsx`, after the existing `albumLinkTarget` computation, add:

```ts
const trackLinkTarget = typeof currentTrack?.id === 'number' && Number.isFinite(currentTrack.id) && currentTrack.id > 0 ? `/track/${currentTrack.id}` : null
```

Expected: only valid positive numeric track IDs become links.

- [ ] **Step 2: Rename metadata navigation handler for reuse**

Change:

```ts
const handleMetadataNavigation = () => {
  setActivePopup(null)
  setShowPresetMenu(false)
  toggleExpanded()
}
```

to:

```ts
const handlePlayerNavigation = () => {
  setActivePopup(null)
  setShowPresetMenu(false)
  toggleExpanded()
}
```

Expected: the same close behavior can be used by track, metadata, and clip links.

- [ ] **Step 3: Update existing metadata links to use the renamed handler**

Replace every `onClick={handleMetadataNavigation}` in `ExpandedPlayer.tsx` with:

```tsx
onClick={handlePlayerNavigation}
```

Expected: artist, playlist, and album links still close the expanded player.

- [ ] **Step 4: Make the title a link when possible**

Replace:

```tsx
<h3 className="truncate text-xl font-bold max-[414px]:text-center max-[414px]:text-lg">{currentTrack?.title || 'Трек не выбран'}</h3>
```

with:

```tsx
<h3 className="truncate text-xl font-bold max-[414px]:text-center max-[414px]:text-lg">
  {trackLinkTarget ? (
    <Link
      to={trackLinkTarget}
      onClick={handlePlayerNavigation}
      className="rounded-sm transition hover:text-purple-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      {currentTrack?.title || 'Трек не выбран'}
    </Link>
  ) : (
    currentTrack?.title || 'Трек не выбран'
  )}
</h3>
```

Expected: clicking the title navigates to `/track/:id` and closes the expanded player without stopping playback.

- [ ] **Step 5: Build-check expanded-player navigation**

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript accepts the new target and handler name.

- [ ] **Step 6: Commit this task**

```bash
git add frontend/src/components/ExpandedPlayer.tsx
git commit -m "feat: link expanded player title to track"
```

---

### Task 5: Expanded player clip button

**Files:**
- Modify: `frontend/src/components/ExpandedPlayer.tsx:1-10`
- Modify: `frontend/src/components/ExpandedPlayer.tsx:51-64`
- Modify: `frontend/src/components/ExpandedPlayer.tsx:160-216`
- Modify: `frontend/src/components/ExpandedPlayer.tsx:524-570`

- [ ] **Step 1: Import the clip icon and Video type**

Change the lucide import from:

```ts
  Heart, Plus, Sliders, X, Music, Volume2, VolumeX, Volume1, Type, Waves
```

to:

```ts
  Heart, Plus, Sliders, X, Music, Volume2, VolumeX, Volume1, Type, Waves, Clapperboard
```

Add this type import after auth imports:

```ts
import type { Video } from '../types'
```

Expected: the button can use the same clip icon as the clips page.

- [ ] **Step 2: Add clip state**

After the lyrics state declarations, add:

```ts
const [trackClip, setTrackClip] = useState<Video | null>(null)
```

Expected: the component can store the first approved clip for the current track.

- [ ] **Step 3: Fetch the clip for the current track**

After the lyrics-loading `useEffect` and before `activeSegmentIndex`, add:

```ts
useEffect(() => {
  const trackId = currentTrack?.id
  setTrackClip(null)

  if (!trackId) return

  let cancelled = false

  fetch('/api/videos')
    .then((response) => {
      if (!response.ok) throw new Error('Failed to load videos')
      return response.json()
    })
    .then((data) => {
      if (cancelled || !Array.isArray(data)) return

      const clip = data.find((video: Video) => {
        const videoTrackId = typeof video.track_id === 'number' ? video.track_id : Number(video.track_id)
        return video.status === 'approved' && videoTrackId === trackId
      })

      setTrackClip(clip || null)
    })
    .catch(() => {
      if (!cancelled) setTrackClip(null)
    })

  return () => {
    cancelled = true
  }
}, [currentTrack?.id])
```

Expected: failed clip loading never blocks the player; button is hidden when no clip is found.

- [ ] **Step 4: Add clip link target**

After `trackLinkTarget`, add:

```ts
const clipLinkTarget = trackClip?.id ? `/video/${trackClip.id}` : null
```

Expected: only an existing clip creates a video link.

- [ ] **Step 5: Add the clip button next to lyrics**

In the left action group near like/playlist/lyrics, after the lyrics button block:

```tsx
<button
  onClick={() => setViewMode('lyrics')}
  disabled={!hasLyrics && !lyricsLoading}
  className="w-10 h-10 flex items-center justify-center rounded-xl transition text-gray-400 hover:text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
  title="Текст песни"
>
  <Type className="w-5 h-5" />
</button>
```

insert:

```tsx
{clipLinkTarget && (
  <Link
    to={clipLinkTarget}
    onClick={handlePlayerNavigation}
    className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    title="Открыть клип"
    aria-label="Открыть клип к треку"
  >
    <Clapperboard className="h-5 w-5" />
  </Link>
)}
```

Expected: the clip button appears only for tracks with approved linked videos and closes the expanded player on navigation.

- [ ] **Step 6: Build-check clip button**

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript accepts the `Video` type and `track_id` comparison.

- [ ] **Step 7: Commit this task**

```bash
git add frontend/src/components/ExpandedPlayer.tsx
git commit -m "feat: add clip shortcut to expanded player"
```

---

### Task 6: Final verification for stage one

**Files:**
- Verify: `frontend/src/pages/PlaylistsPage.tsx`
- Verify: `frontend/src/components/ServiceLogo.tsx`
- Verify: `frontend/src/pages/ConcertPage.tsx`
- Verify: `frontend/src/pages/CheckoutPage.tsx`
- Verify: `frontend/src/components/ExpandedPlayer.tsx`

- [ ] **Step 1: Run production build**

Run:

```bash
cd frontend && npm run build
```

Expected: build completes successfully. If it fails, fix the failing changed file before continuing.

- [ ] **Step 2: Run lint**

Run:

```bash
cd frontend && npm run lint
```

Expected: lint completes successfully or reports only pre-existing warnings/errors outside the files changed by this plan. Changed-file lint errors must be fixed.

- [ ] **Step 3: Check changed diff only**

Run:

```bash
git diff -- frontend/src/pages/PlaylistsPage.tsx frontend/src/components/ServiceLogo.tsx frontend/src/pages/ConcertPage.tsx frontend/src/pages/CheckoutPage.tsx frontend/src/components/ExpandedPlayer.tsx
```

Expected: diff only contains stage-one changes from this plan.

- [ ] **Step 4: Manual browser smoke test**

Start the dev server:

```bash
cd frontend && npm run dev
```

Expected manual results:

1. `/profile/library/playlists`: long playlist names stay inside the cover in two lines.
2. Any page with header/sidebar logo: reveal glow appears immediately and fades smoothly with the logo animation.
3. `/concert/:id`: clicking an available venue zone selects one ticket and reveals the order summary.
4. `/concert/:id`: clicking a sold-out or unlinked zone shows a red toast message.
5. `/checkout` after selecting tickets: selected zone name appears in the order.
6. Expanded player: clicking the track title navigates to `/track/:id` and music keeps playing.
7. Expanded player: clip button appears for a track with approved video and opens `/video/:id`; it is hidden when no clip exists.

- [ ] **Step 5: Commit final verification fixes if any**

If final verification required changes, commit them:

```bash
git add frontend/src/pages/PlaylistsPage.tsx frontend/src/components/ServiceLogo.tsx frontend/src/pages/ConcertPage.tsx frontend/src/pages/CheckoutPage.tsx frontend/src/components/ExpandedPlayer.tsx
git commit -m "fix: polish stage one verification issues"
```

If no files changed after verification, do not create an empty commit.

---

## Self-Review

- Spec coverage:
  - Playlist title wrap: Task 1.
  - Logo glow reveal: Task 2.
  - Concert zone selection and checkout: Task 3.
  - Expanded player track title link: Task 4.
  - Expanded player clip button: Task 5.
  - Build/lint/manual verification: Task 6.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain.
- Type consistency:
  - `TicketCheckoutItem.zoneId` / `zoneName` are created in `ConcertPage` and consumed in `CheckoutPage`.
  - `handlePlayerNavigation` replaces `handleMetadataNavigation` everywhere.
  - `Video.track_id` from `frontend/src/types/index.ts` is used for clip lookup.
