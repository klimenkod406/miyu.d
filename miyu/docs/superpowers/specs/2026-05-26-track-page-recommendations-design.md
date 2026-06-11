# Track Page Recommendations and Playlist Action Design

## Goal

Improve the track page by adding clearer discovery and playlist actions:

- show recommended tracks from other artists;
- replace the existing three-dot action button with an add-to-playlist button;
- remove the animated spinner shown while the track page initially loads.

## Current Context

`frontend/src/pages/TrackPage.tsx` already loads the current track, the full track catalog, like status, and builds local recommendation lists. It currently renders:

- a main track header with play, like, lyrics, and a passive three-dot button;
- same-artist recommendations;
- suggested artists;
- a `Продолжить открытие` section using other-artist catalog tracks;
- `SimilarTracks` from the recommender API.

Playlist add/remove behavior already exists in `frontend/src/hooks/PlayerContext.tsx` and is used by `frontend/src/components/ExpandedPlayer.tsx`.

## Design

### Loading behavior

When `TrackPage` is loading its initial data, it should no longer render an animated circular spinner. The loading branch should return `null` so navigation does not show the loader.

### Playlist action

Replace the three-dot button in the track header with a playlist action button using the existing `ListMusic` icon.

Behavior:

- clicking the button toggles a compact dropdown;
- the dropdown title is `Добавить в плейлист`;
- it lists `player.playlists`;
- clicking a playlist calls `player.addOrRemoveFromPlaylist(playlist.id)`;
- playlists that already contain the current track are highlighted through `player.isTrackInPlaylist(playlist.id)` and show a check mark;
- if the user has no personal playlists, show a small empty-state text.

The dropdown should match the dark rounded style already used on the page and in the expanded player.

### Recommended tracks from other artists

Keep the existing catalog-based recommendation path, but make it explicit:

- only include tracks whose `artist_id` differs from the current track artist;
- prefer tracks with the same `genre` when the current track has a genre;
- limit to 6 tracks;
- render the section as `Рекомендуемые треки других артистов`;
- each item shows cover, title, artist, genre, and a `Слушать` button.

The existing `SimilarTracks` block can remain below this section because it represents a separate audio-similarity recommendation source.

## Data Flow

1. `TrackPage` loads `/api/track/:id` and `/api/tracks`.
2. `discoveryTracks` is derived locally with `artist_id !== track.artist_id` and genre filtering.
3. The playlist dropdown uses `usePlayer()` state and methods already populated by `PlayerContext`.
4. Adding/removing tracks uses the existing playlist API calls inside `PlayerContext`.

## Error Handling

- If the track cannot be loaded, keep the existing red error message.
- If playlist actions fail, keep the existing `PlayerContext` console error behavior.
- If recommendations are empty, hide the section.

## Testing

Run the frontend build after implementation:

```bash
cd frontend && npm run build
```

Manual checks:

- track page opens without an animated loading spinner;
- playlist button opens and closes the dropdown;
- adding/removing a track updates playlist highlight and toast behavior;
- recommendations exclude the current artist;
- recommended tracks play from the section.
