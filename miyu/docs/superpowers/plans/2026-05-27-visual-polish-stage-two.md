# Visual Polish Stage Two Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the final visual polish stage by softening genre visualizer palettes, improving the Miyu Wave launch button, refining the equalizer UI, and then preparing the verified work for merge into `main`.

**Architecture:** Keep the existing player/audio architecture intact. Update only visual constants and component markup/classes in the existing `AudioVisualizer`, `visualizerPalettes`, and `ExpandedPlayer` surfaces; do not change DSP behavior, queue behavior, checkout behavior, or API calls from stage one.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, React Router, Canvas 2D.

---

## File Structure

- Modify: `frontend/src/lib/visualizerPalettes.ts`
  - Replace saturated genre palettes with softer, more genre-distinct palettes.
- Modify: `frontend/src/components/AudioVisualizer.tsx`
  - Polish the center Miyu Wave button and its inner circular gradient glow.
- Modify: `frontend/src/components/ExpandedPlayer.tsx`
  - Refine the equalizer popup visual design: thinner sliders, smaller handles, clearer labels.
- Verify: `frontend/package.json`
  - Use existing `npm run build`; record repo-level lint blocker if unchanged.
- Git integration:
  - After verification, commit selected files and merge the worktree branch into `main` locally because the user explicitly chose “Слить в main”.

No new runtime files are needed.

---

### Task 1: Soften genre visualizer palettes

**Files:**
- Modify: `frontend/src/lib/visualizerPalettes.ts:11-28`

- [ ] **Step 1: Inspect the current palette table**

Confirm `PALETTES` currently uses highly saturated values like:

```ts
rock: [[255, 30, 20], [255, 110, 0], [255, 230, 40]],
pop: [[255, 50, 200], [240, 40, 255], [80, 60, 255]],
electronic: [[0, 230, 255], [40, 100, 255], [200, 40, 255]],
```

Expected: the current palette is vivid but too aggressive for the softer Miyu visual direction.

- [ ] **Step 2: Replace the palette table with softer genre palettes**

Replace the `PALETTES` object with:

```ts
// Mood-driven gradients per genre — soft, readable, and distinct
export const PALETTES: Record<string, Palette> = {
  rock: [[255, 118, 92], [238, 92, 74], [255, 178, 92]],
  metal: [[180, 72, 92], [92, 74, 110], [42, 48, 66]],
  pop: [[255, 142, 202], [218, 132, 255], [124, 158, 255]],
  electronic: [[92, 224, 238], [94, 154, 255], [176, 132, 255]],
  hiphop: [[255, 196, 92], [238, 126, 88], [214, 82, 124]],
  rnb: [[214, 124, 204], [158, 108, 214], [88, 88, 168]],
  jazz: [[255, 204, 122], [198, 132, 92], [96, 88, 158]],
  blues: [[92, 166, 232], [72, 112, 198], [42, 58, 128]],
  classical: [[252, 250, 238], [178, 216, 244], [126, 154, 226]],
  ambient: [[138, 232, 232], [152, 184, 242], [210, 164, 232]],
  folk: [[246, 196, 126], [204, 148, 92], [126, 92, 62]],
  reggae: [[244, 212, 92], [92, 196, 122], [232, 92, 92]],
  country: [[244, 184, 102], [218, 128, 82], [150, 86, 66]],
  punk: [[238, 92, 144], [204, 72, 116], [92, 72, 154]],
  default: [[172, 132, 255], [238, 132, 214], [255, 188, 126]],
}
```

Expected: genres remain visually distinct but less neon/acidic.

- [ ] **Step 3: Keep matching logic unchanged**

Confirm `paletteForGenre()` remains unchanged:

```ts
export function paletteForGenre(genre?: string | null): Palette {
  if (!genre) return PALETTES.default
  const k = genre.toLowerCase()
  ...existing includes checks...
  return PALETTES.default
}
```

Expected: only colors change, not genre detection.

- [ ] **Step 4: Build-check palettes**

Run:

```bash
cd frontend && npm run build
```

Expected: build succeeds with the existing Vite warnings only.

---

### Task 2: Smooth the Miyu Wave launch button

**Files:**
- Modify: `frontend/src/components/AudioVisualizer.tsx:484-525`

- [ ] **Step 1: Inspect current button classes**

Confirm the center button currently uses padding expansion and hover scale:

```tsx
pl-2 pr-2 hover:pl-3 hover:pr-5
bg-white/6 hover:bg-white/10
transition-[padding,background-color,border-color,box-shadow,transform] duration-700 ... hover:scale-[1.015]
```

Expected: expansion exists and can feel slightly jumpy.

- [ ] **Step 2: Replace the button className with softer motion and colors**

Replace the button `className` string with:

```tsx
className="group relative pointer-events-auto
           flex items-center
           h-14 md:h-16
           pl-3 pr-3 hover:pr-5
           max-[414px]:pl-3 max-[414px]:pr-5
           rounded-full
           bg-white/[0.075] hover:bg-white/[0.12]
           max-[414px]:bg-white/[0.11]
           border border-white/14 hover:border-cyan-200/24
           backdrop-blur-2xl
           shadow-[0_12px_38px_rgba(10,12,28,0.30),inset_0_1px_0_rgba(255,255,255,0.18)]
           hover:shadow-[0_18px_48px_rgba(99,102,241,0.20),0_0_36px_rgba(34,211,238,0.12),inset_0_1px_0_rgba(255,255,255,0.22)]
           transition-[padding,background-color,border-color,box-shadow,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:translate-y-[-1px]
           overflow-hidden"
```

Expected: the button still expands to reveal text, but the movement is softer and less jumpy.

- [ ] **Step 3: Replace the inner glow layer**

Replace:

```tsx
<span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-90" />
```

with:

```tsx
<span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.22),transparent_28%),conic-gradient(from_120deg,rgba(34,211,238,0.18),rgba(168,85,247,0.16),rgba(244,114,182,0.14),rgba(34,211,238,0.18))] opacity-70 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100" />
<span className="pointer-events-none absolute inset-[3px] rounded-full border border-white/10 bg-black/10 transition-colors duration-500 group-hover:bg-white/[0.03]" />
```

Expected: hover adds a soft circular gradient inside the button without making it matte or harsh.

- [ ] **Step 4: Soften icon and label color states**

Change the icon wrapper from:

```tsx
<span className="relative flex items-center justify-center w-10 h-10 md:w-12 md:h-12 shrink-0">
```

to:

```tsx
<span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] transition duration-500 group-hover:bg-white/[0.12] md:h-12 md:w-12">
```

Change the label class from:

```tsx
relative whitespace-nowrap text-white font-medium text-base md:text-lg drop-shadow-lg
```

to:

```tsx
relative whitespace-nowrap text-white/92 font-medium text-base md:text-lg drop-shadow-lg transition-colors duration-500 group-hover:text-white
```

Expected: icon and label feel more polished and less stark.

- [ ] **Step 5: Build-check the button**

Run:

```bash
cd frontend && npm run build
```

Expected: build succeeds with existing Vite warnings only.

---

### Task 3: Refine equalizer visual design

**Files:**
- Modify: `frontend/src/components/ExpandedPlayer.tsx:682-756`

- [ ] **Step 1: Inspect current equalizer UI**

Confirm the current popup uses a thick vertical track and handle:

```tsx
className="relative h-28 w-6 bg-white/5 rounded-full overflow-hidden cursor-pointer select-none border border-white/10 hover:border-white/20 transition group"
...
className="absolute left-1/2 -translate-x-1/2 bg-white rounded-full w-3 h-3 shadow-lg transition-all pointer-events-none"
```

Expected: current sliders work, but look heavy.

- [ ] **Step 2: Add band names next to frequency labels**

Inside the `eqBands.map`, replace:

```ts
const freqLabels = ['60Hz', '230Hz', '910Hz', '4kHz', '14kHz']
const percent = ((value + 12) / 24) * 100
```

with:

```ts
const freqLabels = ['60Hz', '230Hz', '910Hz', '4kHz', '14kHz']
const bandLabels = ['Sub', 'Low', 'Mid', 'Presence', 'Air']
const percent = ((value + 12) / 24) * 100
```

Expected: each slider can show a human-readable range name.

- [ ] **Step 3: Make the popup a little more refined**

In the equalizer `motion.div`, change the inline style from:

```tsx
style={{
  background: 'rgba(10, 10, 15, 0.85)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
}}
```

to:

```tsx
style={{
  background: 'linear-gradient(180deg, rgba(14, 14, 22, 0.92), rgba(6, 6, 12, 0.88))',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
}}
```

Expected: panel looks more premium without changing layout.

- [ ] **Step 4: Replace value text with dB pill**

Replace:

```tsx
<span className={`text-xs font-medium transition-colors ${value !== 0 ? 'text-white' : 'text-white/40'}`}>
  {value > 0 ? '+' : ''}{value}
</span>
```

with:

```tsx
<span className={`min-w-9 rounded-full px-2 py-0.5 text-center text-[10px] font-medium transition-colors ${value !== 0 ? 'bg-white/10 text-white' : 'bg-white/[0.04] text-white/40'}`}>
  {value > 0 ? '+' : ''}{value}dB
</span>
```

Expected: gain values are clearer and more compact.

- [ ] **Step 5: Make slider tracks and handles thinner**

Replace the slider track div classes:

```tsx
className="relative h-28 w-6 bg-white/5 rounded-full overflow-hidden cursor-pointer select-none border border-white/10 hover:border-white/20 transition group"
```

with:

```tsx
className="group relative h-28 w-3 cursor-pointer select-none overflow-hidden rounded-full border border-white/10 bg-white/[0.045] transition hover:border-white/25"
```

Replace the filled bar classes:

```tsx
className="absolute bottom-0 left-0 right-0 bg-white/80 transition-all duration-150 rounded-full"
```

with:

```tsx
className="absolute bottom-0 left-0 right-0 rounded-full bg-gradient-to-t from-cyan-200/75 via-violet-200/80 to-white/90 transition-all duration-150"
```

Replace the handle classes:

```tsx
className="absolute left-1/2 -translate-x-1/2 bg-white rounded-full w-3 h-3 shadow-lg transition-all pointer-events-none"
```

with:

```tsx
className="pointer-events-none absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.45)] transition-all"
```

Expected: sliders are thinner and more elegant while preserving drag behavior.

- [ ] **Step 6: Add band labels under frequencies**

Replace:

```tsx
<span className="text-[10px] text-white/40 font-medium">{freqLabels[index]}</span>
```

with:

```tsx
<div className="text-center leading-tight">
  <span className="block text-[10px] font-medium text-white/45">{freqLabels[index]}</span>
  <span className="block text-[9px] text-white/25">{bandLabels[index]}</span>
</div>
```

Expected: equalizer feels more detailed without adding new controls.

- [ ] **Step 7: Build-check the equalizer**

Run:

```bash
cd frontend && npm run build
```

Expected: build succeeds with existing Vite warnings only.

---

### Task 4: Final verification and merge to main

**Files:**
- Verify and stage only:
  - `frontend/src/lib/visualizerPalettes.ts`
  - `frontend/src/components/AudioVisualizer.tsx`
  - `frontend/src/components/ExpandedPlayer.tsx`
  - stage-one files already changed and verified:
    - `frontend/src/pages/PlaylistsPage.tsx`
    - `frontend/src/components/ServiceLogo.tsx`
    - `frontend/src/pages/ConcertPage.tsx`
    - `frontend/src/pages/CheckoutPage.tsx`
  - plan docs:
    - `docs/superpowers/plans/2026-05-27-bugfix-stage-one.md`
    - `docs/superpowers/plans/2026-05-27-visual-polish-stage-two.md`

- [ ] **Step 1: Run production build**

Run:

```bash
cd frontend && npm run build
```

Expected: build completes successfully. Existing Vite warnings about `colorExtractor.ts` and large chunks are acceptable.

- [ ] **Step 2: Run lint and record known blocker**

Run:

```bash
cd frontend && npm run lint
```

Expected: currently fails before linting because ESLint 9 cannot find `eslint.config.(js|mjs|cjs)`. If this is still the output, record it as repo-level lint infrastructure blocker, not a changed-file lint failure.

- [ ] **Step 3: Review focused diff**

Run:

```bash
git diff -- frontend/src/lib/visualizerPalettes.ts frontend/src/components/AudioVisualizer.tsx frontend/src/components/ExpandedPlayer.tsx frontend/src/pages/PlaylistsPage.tsx frontend/src/components/ServiceLogo.tsx frontend/src/pages/ConcertPage.tsx frontend/src/pages/CheckoutPage.tsx docs/superpowers/plans/2026-05-27-bugfix-stage-one.md docs/superpowers/plans/2026-05-27-visual-polish-stage-two.md
```

Expected: diff includes only stage-one fixes, stage-two visual polish, and plan docs.

- [ ] **Step 4: Run independent verification**

Dispatch `verification` agent with:

```text
Original request: complete stage one and stage two, then merge to main.
Changed files: list all files from Step 3.
Approach: stage one bug fixes + stage two visual polish.
Required checks: build, lint blocker classification, diff/requirements review.
```

Expected: verifier returns `PASS` or `PARTIAL` only due the known lint infrastructure blocker. If verifier returns `FAIL`, fix issues and re-run verification.

- [ ] **Step 5: Commit selected files**

Only after verification passes, stage specific files:

```bash
git add frontend/src/lib/visualizerPalettes.ts frontend/src/components/AudioVisualizer.tsx frontend/src/components/ExpandedPlayer.tsx frontend/src/pages/PlaylistsPage.tsx frontend/src/components/ServiceLogo.tsx frontend/src/pages/ConcertPage.tsx frontend/src/pages/CheckoutPage.tsx docs/superpowers/plans/2026-05-27-bugfix-stage-one.md docs/superpowers/plans/2026-05-27-visual-polish-stage-two.md
git commit -m "$(cat <<'EOF'
feat(ui): polish player visuals and ticket flow

Smooth Miyu visual polish while fixing playlist wrapping, logo glow timing, concert zone checkout, and expanded-player navigation.

Co-Authored-By: OpenClaude (cx/gpt-5.5-xhigh) <openclaude@gitlawb.com>
EOF
)"
```

Expected: commit succeeds. If hooks fail, fix the underlying issue and create a new commit; do not use `--no-verify`.

- [ ] **Step 6: Merge into main locally**

Because the user explicitly requested transfer to the main branch, run:

```bash
git status --short
git switch main
git merge worktree-track-page-recommendations
```

Expected: merge succeeds or reports conflicts. If conflicts appear, stop and resolve them carefully; do not discard unrelated work.

- [ ] **Step 7: Verify main after merge**

Run:

```bash
cd frontend && npm run build
```

Expected: build succeeds on `main` with the same acceptable Vite warnings.

---

## Self-Review

- Spec coverage:
  - Genre palettes: Task 1.
  - Miyu Wave button hover/motion/color polish: Task 2.
  - Equalizer thinner, more detailed controls: Task 3.
  - Build/lint/diff/verification/commit/main merge: Task 4.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain.
- Type consistency:
  - `Palette` remains `[RGB, RGB, RGB]`.
  - Existing `paletteForGenre()` API is unchanged.
  - Existing equalizer state (`eqBands`, `eqPreset`, `setEqBand`) is unchanged.
  - Git merge target is the current branch name `worktree-track-page-recommendations` into `main`.
