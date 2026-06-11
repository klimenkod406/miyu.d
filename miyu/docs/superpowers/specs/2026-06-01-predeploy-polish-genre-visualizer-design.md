# Predeploy polish, genre search and visualizer design

## Context

Before deploying the fixed admin batch upload flow, the project needs seven additional improvements:

1. Restyle the track lyrics popup.
2. Verify and fix genre assignment during AI analysis.
3. Stop the animated play bars on the home track card when paused.
4. Make mini-player progress visible for tracks without cover art.
5. Add genre search/filtering.
6. Verify genre-based visualizer colors.
7. Apply the large visualizer music-response logic to the mini visualizer.

The chosen approach is focused polish plus AI diagnostics: complete all seven items without a large architecture rewrite before deployment.

## Design

### Lyrics popup

`frontend/src/pages/TrackPage.tsx` will replace the current right-side lyrics drawer with a toast-like top overlay. It should visually match existing notification/achievement popups:

- fixed top-center placement;
- glass/backdrop blur styling;
- rounded card with soft border and shadow;
- `framer-motion` enter from above and exit back upward;
- scrollable lyrics body with max viewport height.

The overlay should feel like a notification-style popup, not a full modal page. A light backdrop may remain only if it helps close-on-click behavior without visually dominating the page.

### AI genre assignment

The current AI genre path is:

- `ai-service/app/analysis/tagging.py` predicts `genre_tags` from PANNs;
- `ai-service/app/analysis/repository.py` selects `genre_tags[0]` as `primary_genre`;
- `update_track_public_fields()` writes `tracks.genre` only when it is empty.

The fix should keep the rule that manual genres are not overwritten. It should make genre assignment more reliable by:

- testing normalization of genre labels;
- selecting the strongest valid genre tag from the genre tag list;
- ensuring multiple analyzed tracks can receive genres when their public `tracks.genre` is empty;
- preserving existing non-empty `tracks.genre` values.

If PANNs assets are missing and no genre tag exists, the pipeline should not invent a genre blindly. It may keep the genre empty and log/record the lack of tags.

### Home track-card play bars

`frontend/src/pages/HomePage.tsx` currently shows animated bars for the current track even when paused. The corrected behavior:

- bars animate only when `isPlaying && isCurrentTrack`;
- when current but paused, show a static play button/state;
- clicking still resumes/starts playback as before.

### Mini-player progress without cover

`frontend/src/components/MiniPlayer.tsx` currently clips the blurred cover image to show progress. For tracks without cover art:

- render a fallback progress fill;
- use a white translucent gradient/color;
- keep the existing cover-based progress when cover art exists.

### Genre search

`frontend/src/pages/GenresPage.tsx` should link to a genre-aware search URL, preferably `/search?genre=<name>`. `SearchPage` should detect this parameter and show a genre-filtered result context.

Expected behavior:

- genre card click opens search results for that genre;
- result title/chip communicates the selected genre;
- track results are filtered by exact/normalized genre match;
- existing text search by `q` remains unchanged.

Backend search changes may be needed if the current API cannot filter by genre. The implementation should prefer a backend filter so large catalogs are not filtered only on the client.

### Visualizer palette coverage

`frontend/src/lib/visualizerPalettes.ts` already maps many Russian and English labels. It should be extended/verified for labels produced by AI normalization:

- `Соул`;
- `Lo-fi`;
- `Панк-рок`;
- `Эмбиент`;
- common English variants such as `dance music`, `hip hop`, `house`, `techno`, `trance`.

Both big and mini visualizers should continue using `paletteForGenre(currentTrack.genre)`.

### Mini visualizer response

`frontend/src/components/MiniAudioVisualizer.tsx` should adopt the large visualizer's response principles while staying compact:

- bass/mid/treble/vocal/presence frequency bands;
- activity envelope with attack/release smoothing;
- beat detection from bass spikes;
- per-ring band smoothing;
- palette lerp from genre;
- idle behavior when paused or when audio is silent.

This is a targeted parity improvement, not a full shared-engine refactor. The mini visualizer can keep fewer rings and smaller glow values.

## Testing and verification

Required verification before deployment:

- backend build;
- AI service tests for genre normalization/public genre update;
- frontend build;
- existing upload regression tests remain passing;
- manual UI smoke for lyrics popup, home card pause state, mini-player fallback progress, genre search URL, and mini visualizer.

## Scope boundaries

This spec does not include:

- redesigning the whole player;
- changing AI model choices or downloading heavier models;
- replacing PANNs with a different classifier;
- a full shared canvas visualizer engine refactor;
- deploying before local verification passes.
