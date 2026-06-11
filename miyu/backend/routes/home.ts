import { Router, Response } from 'express';
import { getAll, getOne, runQuery } from '../db';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

const AI_BASE = (process.env.AI_SERVICE_URL || 'http://localhost:8001').replace(/\/$/, '');
const AI_ENABLED = (process.env.AI_SERVICE_ENABLED ?? 'true').toLowerCase() !== 'false';
const DAILY_LIMIT = 50;
const MOOD_PLAYLIST_COUNT = 6;
const MOOD_PLAYLIST_TRACKS = 20;

type HomeArtist = {
  id: number;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  is_premium: boolean;
  reason: string;
  listened_seconds?: number;
  genre?: string | null;
};

type HomePlaylist = {
  id: number;
  title: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  is_system: boolean;
  is_pinned: boolean;
  track_count: number;
  kind: 'mood' | 'daily';
  slot_key: string;
};

type PersonalizedProfile = {
  top_genres: { tag: string; weight: number }[];
  top_moods: { tag: string; weight: number }[];
  energy_mean: number | null;
  valence_mean: number | null;
  danceability_mean: number | null;
};

type CandidateTrack = {
  id: number;
  title: string;
  duration: number;
  cover_url: string | null;
  file_path: string | null;
  genre: string | null;
  artist_id: number;
  artist_name: string;
  artist_is_verified: number;
  album_id: number | null;
  album_title: string | null;
  album_cover: string | null;
  mood_tags: string | null;
  energy: number | null;
  valence: number | null;
  danceability: number | null;
  play_count: number;
  created_at: string;
};

type FeedTrack = {
  id: number;
  score?: number;
};

const MOOD_TEMPLATES = [
  {
    slot_key: 'focus',
    title: 'Фокус без шума',
    description: 'Спокойный поток для работы, чтения и концентрации.',
    moods: ['calm', 'neutral', 'focused', 'ambient'],
    targetEnergy: 0.35,
    targetValence: 0.45,
    targetDanceability: 0.35,
    colors: ['#1D4ED8', '#2563EB', '#60A5FA'],
  },
  {
    slot_key: 'relax',
    title: 'Мягкий релакс',
    description: 'Для отдыха, вечернего замедления и тёплого фона.',
    moods: ['calm', 'dreamy', 'melancholic', 'neutral'],
    targetEnergy: 0.25,
    targetValence: 0.5,
    targetDanceability: 0.3,
    colors: ['#0F766E', '#14B8A6', '#5EEAD4'],
  },
  {
    slot_key: 'drive',
    title: 'Энергия на максимум',
    description: 'Под тренировки, движение и моменты, когда нужен импульс.',
    moods: ['energetic', 'aggressive', 'happy', 'party'],
    targetEnergy: 0.82,
    targetValence: 0.68,
    targetDanceability: 0.72,
    colors: ['#B91C1C', '#F97316', '#FDBA74'],
  },
  {
    slot_key: 'road',
    title: 'Для дороги',
    description: 'Ритм для поездки, прогулки и долгого пути.',
    moods: ['uplifting', 'energetic', 'neutral', 'dreamy'],
    targetEnergy: 0.62,
    targetValence: 0.62,
    targetDanceability: 0.58,
    colors: ['#7C3AED', '#A855F7', '#F0ABFC'],
  },
  {
    slot_key: 'night',
    title: 'Ночной вайб',
    description: 'Треки для поздних часов, неона и мягкого грува.',
    moods: ['dark', 'sensual', 'dreamy', 'neutral'],
    targetEnergy: 0.48,
    targetValence: 0.42,
    targetDanceability: 0.64,
    colors: ['#111827', '#312E81', '#7C3AED'],
  },
  {
    slot_key: 'inspiration',
    title: 'Музыка для вдохновения',
    description: 'Когда хочется новых идей, света и красивых переходов.',
    moods: ['uplifting', 'happy', 'epic', 'neutral'],
    targetEnergy: 0.56,
    targetValence: 0.74,
    targetDanceability: 0.5,
    colors: ['#D97706', '#F59E0B', '#FDE68A'],
  },
] as const;

async function aiFetch(path: string, init?: RequestInit): Promise<{ status: number; data: any }> {
  if (!AI_ENABLED) return { status: 503, data: { error: 'ai disabled' } };
  try {
    const r = await fetch(`${AI_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers as any) },
    });
    const text = await r.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: r.status, data };
  } catch (e: any) {
    return { status: 502, data: { error: 'ai-service unreachable', detail: e?.message } };
  }
}

function dateKeyUtc(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function clamp01(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function normalizeAvatarUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('/uploads/')) return value;
  return `/uploads/avatars/${value}`;
}

function normalizeTrackCover(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('/uploads/') || value.startsWith('data:image/')) return value;
  return `/uploads/tracks/${value}`;
}

function normalizeAlbumCover(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('/uploads/') || value.startsWith('data:image/')) return value;
  return `/uploads/albums/${value}`;
}

function normalizePlaylistCover(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('/uploads/') || value.startsWith('data:image/')) return value;
  return `/uploads/playlists/${value}`;
}

function buildSvgCover(title: string, subtitle: string, colors: [string, string, string]): string {
  const escape = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const wrapTitle = (value: string, maxCharsPerLine: number, maxLines: number) => {
    const words = value.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];

    const lines: string[] = [];
    let currentLine = '';
    let wordIndex = 0;

    for (; wordIndex < words.length; wordIndex += 1) {
      const word = words[wordIndex];
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (candidate.length <= maxCharsPerLine || !currentLine) {
        currentLine = candidate;
        continue;
      }

      lines.push(currentLine);
      currentLine = word;

      if (lines.length === maxLines - 1) break;
    }

    const remainingWords = words.slice(wordIndex);
    const finalLine = [currentLine, ...remainingWords].filter(Boolean).join(' ').trim();

    if (finalLine) {
      lines.push(finalLine);
    }

    if (lines.length > maxLines) {
      return lines.slice(0, maxLines);
    }

    return lines;
  };

  const titleLines = wrapTitle(title, 16, 3);
  const titleFontSize = titleLines.length >= 3 ? 92 : titleLines.length === 2 ? 104 : 118;
  const titleLineHeight = titleLines.length >= 3 ? 106 : 114;
  const titleStartY = 910 - (titleLines.length - 1) * titleLineHeight;
  const titleMarkup = titleLines
    .map((line, index) => `<tspan x="110" y="${titleStartY + index * titleLineHeight}">${escape(line)}</tspan>`)
    .join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${colors[0]}"/>
          <stop offset="55%" stop-color="${colors[1]}"/>
          <stop offset="100%" stop-color="${colors[2]}"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="1200" fill="url(#bg)" rx="96"/>
      <circle cx="950" cy="260" r="220" fill="rgba(255,255,255,0.12)"/>
      <circle cx="260" cy="980" r="260" fill="rgba(255,255,255,0.08)"/>
      <rect x="84" y="84" width="1032" height="1032" rx="72" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)"/>
      <text x="110" y="200" fill="rgba(255,255,255,0.9)" font-size="82" font-family="Inter, Arial, sans-serif" font-weight="800">Miyu</text>
      <text x="110" fill="#ffffff" font-size="${titleFontSize}" font-family="Inter, Arial, sans-serif" font-weight="800">${titleMarkup}</text>
      <text x="110" y="1000" fill="rgba(255,255,255,0.94)" font-size="52" font-family="Inter, Arial, sans-serif" font-weight="600">${escape(subtitle)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function getProfilePreferences(userId: number): Promise<PersonalizedProfile> {
  const aiProfile = await aiFetch(`/recsys/profile/${userId}`);
  if (aiProfile.status === 200 && aiProfile.data) {
    return {
      top_genres: Array.isArray(aiProfile.data.top_genres) ? aiProfile.data.top_genres : [],
      top_moods: Array.isArray(aiProfile.data.top_moods) ? aiProfile.data.top_moods : [],
      energy_mean: typeof aiProfile.data.energy_mean === 'number' ? aiProfile.data.energy_mean : null,
      valence_mean: typeof aiProfile.data.valence_mean === 'number' ? aiProfile.data.valence_mean : null,
      danceability_mean: typeof aiProfile.data.danceability_mean === 'number' ? aiProfile.data.danceability_mean : null,
    };
  }

  const genreRows = await getAll<{ genre: string; weight: number }>(
    `SELECT t.genre as genre, COUNT(*) as weight
     FROM track_plays tp
     JOIN tracks t ON t.id = tp.track_id
     WHERE tp.user_id = ? AND t.genre IS NOT NULL AND t.genre != ''
     GROUP BY t.genre
     ORDER BY weight DESC
     LIMIT 6`,
    [userId],
  );

  const moodRows = await getAll<{ mood_tags: string | null }>(
    `SELECT ta.mood_tags
     FROM track_plays tp
     JOIN track_analysis ta ON ta.track_id = tp.track_id
     WHERE tp.user_id = ? AND ta.mood_tags IS NOT NULL AND ta.mood_tags != ''
     ORDER BY tp.created_at DESC
     LIMIT 200`,
    [userId],
  );

  const moodWeights = new Map<string, number>();
  for (const row of moodRows) {
    for (const mood of String(row.mood_tags || '').split(',').map((item) => item.trim()).filter(Boolean)) {
      moodWeights.set(mood, (moodWeights.get(mood) || 0) + 1);
    }
  }

  return {
    top_genres: genreRows.map((row) => ({ tag: row.genre, weight: row.weight })),
    top_moods: [...moodWeights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, weight]) => ({ tag, weight })),
    energy_mean: null,
    valence_mean: null,
    danceability_mean: null,
  };
}

async function getFeedTracks(userId: number, limit = 100): Promise<FeedTrack[]> {
  const response = await aiFetch(`/recsys/feed?user_id=${userId}&limit=${limit}`);
  if (response.status !== 200 || !Array.isArray(response.data?.tracks)) {
    return [];
  }
  return response.data.tracks;
}

async function getFeaturedArtists(userId: number, profile: PersonalizedProfile): Promise<HomeArtist[]> {
  const listenedArtists = await getAll<any>(
    `SELECT
       u.id,
       u.username,
       u.avatar_url,
       u.bio,
       u.is_verified,
       u.is_premium,
       COALESCE(ap.genre, MAX(t.genre)) as genre,
       SUM(tp.play_duration) as listened_seconds,
       COUNT(tp.id) as plays_count
     FROM track_plays tp
     JOIN tracks t ON tp.track_id = t.id
     JOIN users u ON t.artist_id = u.id
     LEFT JOIN artist_profiles ap ON ap.user_id = u.id
     WHERE tp.user_id = ? AND t.status = 'approved'
     GROUP BY u.id
     ORDER BY listened_seconds DESC, plays_count DESC
     LIMIT 30`,
    [userId],
  );

  const followedRows = await getAll<{ artist_id: number }>('SELECT artist_id FROM artist_follows WHERE user_id = ?', [userId]);
  const followedArtistIds = new Set(followedRows.map((row) => Number(row.artist_id)));
  const favoriteThreshold = 7200;

  const almostFavorite = listenedArtists
    .filter((artist: any) => Number(artist.listened_seconds || 0) >= 1800 && Number(artist.listened_seconds || 0) < favoriteThreshold)
    .map((artist: any) => ({
      id: Number(artist.id),
      username: artist.username,
      avatar_url: normalizeAvatarUrl(artist.avatar_url),
      bio: artist.bio,
      is_verified: !!artist.is_verified,
      is_premium: !!artist.is_premium,
      listened_seconds: Number(artist.listened_seconds || 0),
      genre: artist.genre,
      reason: 'Вы часто возвращаетесь к этому артисту',
    } satisfies HomeArtist));

  const seedGenres = new Set<string>();
  for (const genre of profile.top_genres.slice(0, 4)) {
    if (genre.tag) seedGenres.add(String(genre.tag).toLowerCase());
  }
  for (const artist of listenedArtists.slice(0, 8)) {
    if (artist.genre) seedGenres.add(String(artist.genre).toLowerCase());
  }

  const heardArtistIds = new Set(listenedArtists.map((artist: any) => Number(artist.id)));
  const candidateArtists = await getAll<any>(
    `SELECT
       u.id,
       u.username,
       u.avatar_url,
       u.bio,
       u.is_verified,
       u.is_premium,
       COALESCE(ap.genre, MAX(t.genre)) as genre,
       COUNT(DISTINCT t.id) as track_count,
       COALESCE(SUM(tp.id IS NOT NULL), 0) as play_count
     FROM users u
     LEFT JOIN artist_profiles ap ON ap.user_id = u.id
     JOIN tracks t ON t.artist_id = u.id AND t.status = 'approved'
     LEFT JOIN track_plays tp ON tp.track_id = t.id
     WHERE u.role = 'artist'
     GROUP BY u.id
     ORDER BY play_count DESC, track_count DESC, u.created_at DESC
     LIMIT 150`,
    [],
  );

  const similarArtists = candidateArtists
    .filter((artist: any) => !heardArtistIds.has(Number(artist.id)) && !followedArtistIds.has(Number(artist.id)))
    .map((artist: any) => {
      const normalizedGenre = String(artist.genre || '').toLowerCase();
      let score = 0;
      if (normalizedGenre && seedGenres.has(normalizedGenre)) score += 8;
      const genreTokens = normalizedGenre.split(/[\s,/]+/).filter(Boolean);
      for (const token of genreTokens) {
        if (seedGenres.has(token)) score += 2.5;
      }
      score += Math.min(Number(artist.play_count || 0) / 200, 4);
      return {
        id: Number(artist.id),
        username: artist.username,
        avatar_url: normalizeAvatarUrl(artist.avatar_url),
        bio: artist.bio,
        is_verified: !!artist.is_verified,
        is_premium: !!artist.is_premium,
        genre: artist.genre,
        listened_seconds: 0,
        reason: 'Похож на артистов, которых вы уже слушаете',
        _score: score,
      };
    })
    .filter((artist: any) => artist._score > 0)
    .sort((a: any, b: any) => b._score - a._score)
    .slice(0, 12);

  const merged = new Map<number, HomeArtist>();
  for (const artist of [...almostFavorite, ...similarArtists]) {
    if (!merged.has(artist.id)) merged.set(artist.id, artist as HomeArtist);
    if (merged.size >= 6) break;
  }

  if (merged.size < 6) {
    for (const artist of listenedArtists.slice(0, 12)) {
      const id = Number(artist.id);
      if (merged.has(id) || Number(artist.listened_seconds || 0) >= favoriteThreshold) continue;
      merged.set(id, {
        id,
        username: artist.username,
        avatar_url: normalizeAvatarUrl(artist.avatar_url),
        bio: artist.bio,
        is_verified: !!artist.is_verified,
        is_premium: !!artist.is_premium,
        listened_seconds: Number(artist.listened_seconds || 0),
        genre: artist.genre,
        reason: 'Вы уже замечаете этого артиста всё чаще',
      });
      if (merged.size >= 6) break;
    }
  }

  return [...merged.values()].slice(0, 6);
}

async function getTrackCandidatePool(userId: number): Promise<CandidateTrack[]> {
  return getAll<CandidateTrack>(
    `SELECT
       t.id,
       t.title,
       t.duration,
       t.cover_url,
       t.file_path,
       t.genre,
       t.artist_id,
       u.username as artist_name,
       u.is_verified as artist_is_verified,
       a.id as album_id,
       a.title as album_title,
       a.cover_url as album_cover,
       ta.mood_tags,
       ta.energy,
       ta.valence,
       ta.danceability,
       COALESCE((SELECT COUNT(*) FROM track_plays tp2 WHERE tp2.track_id = t.id), 0) as play_count,
       t.created_at
     FROM tracks t
     JOIN users u ON u.id = t.artist_id
     LEFT JOIN albums a ON a.id = t.album_id
     LEFT JOIN track_analysis ta ON ta.track_id = t.id
     WHERE t.status = 'approved'
       AND t.artist_id != ?
     ORDER BY play_count DESC, t.created_at DESC
     LIMIT 900`,
    [userId],
  );
}

function scoreTrackForProfile(track: CandidateTrack, profile: PersonalizedProfile, feedBoostIds: Set<number>): number {
  let score = 0;
  const genre = String(track.genre || '').toLowerCase();
  const moods = String(track.mood_tags || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);

  for (const [index, item] of profile.top_genres.slice(0, 5).entries()) {
    const tag = String(item.tag || '').toLowerCase();
    if (!tag || !genre) continue;
    if (genre === tag) score += 10 - index * 1.2;
    else if (genre.includes(tag) || tag.includes(genre)) score += 6 - index;
  }

  for (const [index, item] of profile.top_moods.slice(0, 5).entries()) {
    const tag = String(item.tag || '').toLowerCase();
    if (tag && moods.includes(tag)) score += 7 - index;
  }

  if (feedBoostIds.has(track.id)) score += 9;
  score += Math.min(track.play_count / 250, 5);

  return score;
}

function scoreTrackForTemplate(track: CandidateTrack, profile: PersonalizedProfile, template: typeof MOOD_TEMPLATES[number], feedBoostIds: Set<number>): number {
  let score = scoreTrackForProfile(track, profile, feedBoostIds);
  const moods = String(track.mood_tags || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  for (const mood of template.moods) {
    if (moods.includes(mood)) score += 7;
  }

  const energy = clamp01(track.energy, clamp01(profile.energy_mean, template.targetEnergy));
  const valence = clamp01(track.valence, clamp01(profile.valence_mean, template.targetValence));
  const danceability = clamp01(track.danceability, clamp01(profile.danceability_mean, template.targetDanceability));

  score += Math.max(0, 5 - Math.abs(energy - template.targetEnergy) * 10);
  score += Math.max(0, 4 - Math.abs(valence - template.targetValence) * 8);
  score += Math.max(0, 4 - Math.abs(danceability - template.targetDanceability) * 8);

  return score;
}

function pickTracks(
  scoredTracks: Array<{ track: CandidateTrack; score: number }>,
  limit: number,
  excludeGlobal: Set<number>,
): CandidateTrack[] {
  const chosen: CandidateTrack[] = [];
  const localIds = new Set<number>();

  for (const item of scoredTracks) {
    if (localIds.has(item.track.id) || excludeGlobal.has(item.track.id)) continue;
    chosen.push(item.track);
    localIds.add(item.track.id);
    if (chosen.length >= limit) break;
  }

  if (chosen.length < limit) {
    for (const item of scoredTracks) {
      if (localIds.has(item.track.id)) continue;
      chosen.push(item.track);
      localIds.add(item.track.id);
      if (chosen.length >= limit) break;
    }
  }

  return chosen;
}

async function clearPlaylistTracks(playlistId: number) {
  await runQuery('DELETE FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
}

async function insertPlaylistTracks(playlistId: number, trackIds: number[]) {
  for (const [index, trackId] of trackIds.entries()) {
    await runQuery(
      'INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)',
      [playlistId, trackId, index + 1],
    );
  }
}

async function createPlaylist(userId: number, title: string, description: string, coverUrl: string): Promise<number> {
  const result = await runQuery(
    'INSERT INTO playlists (user_id, title, description, cover_url, is_public, is_system, is_pinned) VALUES (?, ?, ?, ?, 0, 1, 0)',
    [userId, title, description, coverUrl],
  );
  return Number(result.lastID);
}

async function deletePlaylist(playlistId: number) {
  await runQuery('DELETE FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
  await runQuery('DELETE FROM playlists WHERE id = ?', [playlistId]);
}

async function generateHomeCollections(userId: number) {
  const generatedFor = dateKeyUtc();
  const profile = await getProfilePreferences(userId);
  const feedTracks = await getFeedTracks(userId, 100);
  const feedBoostIds = new Set(feedTracks.map((track) => Number(track.id)).filter(Boolean));
  const candidatePool = await getTrackCandidatePool(userId);
  const featuredArtists = await getFeaturedArtists(userId, profile);

  const scoredPool = candidatePool
    .map((track) => ({ track, score: scoreTrackForProfile(track, profile, feedBoostIds) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const previousMoodRows = await getAll<{ playlist_id: number }>(
    `SELECT playlist_id
     FROM personalized_home_playlists
     WHERE user_id = ? AND kind = 'mood'`,
    [userId],
  );

  for (const row of previousMoodRows) {
    await deletePlaylist(Number(row.playlist_id));
  }
  await runQuery(`DELETE FROM personalized_home_playlists WHERE user_id = ? AND kind = 'mood'`, [userId]);

  let dailyPlaylistId: number | null = null;
  const existingDaily = await getOne<{ playlist_id: number }>(
    `SELECT playlist_id
     FROM personalized_home_playlists
     WHERE user_id = ? AND kind = 'daily'
     LIMIT 1`,
    [userId],
  );
  if (existingDaily?.playlist_id) {
    const playlistExists = await getOne<{ id: number }>('SELECT id FROM playlists WHERE id = ?', [existingDaily.playlist_id]);
    if (playlistExists?.id) {
      dailyPlaylistId = Number(existingDaily.playlist_id);
    } else {
      await runQuery(`DELETE FROM personalized_home_playlists WHERE user_id = ? AND kind = 'daily'`, [userId]);
    }
  }

  if (!dailyPlaylistId) {
    dailyPlaylistId = await createPlaylist(
      userId,
      'Плейлист дня',
      '50 треков, собранных специально для вас на сегодня.',
      buildSvgCover('Плейлист дня', 'Сегодня для вас', ['#EA580C', '#FB923C', '#FDE68A']),
    );
  } else {
    await runQuery(
      `UPDATE playlists
       SET title = ?, description = ?, cover_url = ?, is_system = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        'Плейлист дня',
        '50 треков, собранных специально для вас на сегодня.',
        buildSvgCover('Плейлист дня', 'Сегодня для вас', ['#EA580C', '#FB923C', '#FDE68A']),
        dailyPlaylistId,
      ],
    );
  }

  const excludedForMood = new Set<number>();
  const moodPlaylists: Array<HomePlaylist & { trackIds: number[] }> = [];

  for (const template of MOOD_TEMPLATES.slice(0, MOOD_PLAYLIST_COUNT)) {
    const scored = candidatePool
      .map((track) => ({ track, score: scoreTrackForTemplate(track, profile, template, feedBoostIds) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const selectedTracks = pickTracks(scored, MOOD_PLAYLIST_TRACKS, excludedForMood);
    for (const track of selectedTracks) excludedForMood.add(track.id);

    const coverUrl = buildSvgCover(template.title, 'Под любое настроение', template.colors as [string, string, string]);
    const playlistId = await createPlaylist(userId, template.title, template.description, coverUrl);
    await insertPlaylistTracks(playlistId, selectedTracks.map((track) => track.id));
    await runQuery(
      `INSERT INTO personalized_home_playlists (user_id, playlist_id, kind, slot_key, generated_for, created_at, updated_at)
       VALUES (?, ?, 'mood', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userId, playlistId, template.slot_key, generatedFor],
    );

    moodPlaylists.push({
      id: playlistId,
      title: template.title,
      description: template.description,
      cover_url: coverUrl,
      is_public: false,
      is_system: true,
      is_pinned: false,
      track_count: selectedTracks.length,
      kind: 'mood',
      slot_key: template.slot_key,
      trackIds: selectedTracks.map((track) => track.id),
    });
  }

  const dailyTrackIds = [
    ...feedTracks.map((track) => Number(track.id)).filter(Boolean),
    ...scoredPool.map((item) => item.track.id),
  ].filter((id, index, array) => array.indexOf(id) === index).slice(0, DAILY_LIMIT);

  await clearPlaylistTracks(dailyPlaylistId);
  await insertPlaylistTracks(dailyPlaylistId, dailyTrackIds);

  await runQuery(`DELETE FROM personalized_home_playlists WHERE user_id = ? AND kind = 'daily'`, [userId]);
  await runQuery(
    `INSERT INTO personalized_home_playlists (user_id, playlist_id, kind, slot_key, generated_for, created_at, updated_at)
     VALUES (?, ?, 'daily', 'playlist_of_day', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [userId, dailyPlaylistId, generatedFor],
  );

  await runQuery(
    `INSERT INTO personalized_home_cache (user_id, generated_for, featured_artists_json, daily_playlist_id, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       generated_for = excluded.generated_for,
       featured_artists_json = excluded.featured_artists_json,
       daily_playlist_id = excluded.daily_playlist_id,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, generatedFor, JSON.stringify(featuredArtists), dailyPlaylistId],
  );
}

async function getStoredPlaylists(userId: number): Promise<{ moodPlaylists: HomePlaylist[]; playlistOfDay: HomePlaylist | null }> {
  const rows = await getAll<any>(
    `SELECT
       p.id,
       p.title,
       p.description,
       p.cover_url,
       p.is_public,
       p.is_system,
       p.is_pinned,
       ph.kind,
       ph.slot_key,
       COUNT(pt.track_id) as track_count
     FROM personalized_home_playlists ph
     JOIN playlists p ON p.id = ph.playlist_id
     LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
     WHERE ph.user_id = ?
     GROUP BY p.id, ph.kind, ph.slot_key
     ORDER BY CASE ph.kind WHEN 'daily' THEN 0 ELSE 1 END, ph.created_at ASC`,
    [userId],
  );

  const normalized = rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    description: row.description,
    cover_url: normalizePlaylistCover(row.cover_url),
    is_public: !!row.is_public,
    is_system: !!row.is_system,
    is_pinned: !!row.is_pinned,
    track_count: Number(row.track_count || 0),
    kind: row.kind as 'mood' | 'daily',
    slot_key: row.slot_key,
  } satisfies HomePlaylist));

  return {
    playlistOfDay: normalized.find((item) => item.kind === 'daily') || null,
    moodPlaylists: normalized.filter((item) => item.kind === 'mood'),
  };
}

async function ensurePersonalizedHome(userId: number) {
  const today = dateKeyUtc();
  const cache = await getOne<{ generated_for: string | null; featured_artists_json: string | null }>(
    'SELECT generated_for, featured_artists_json FROM personalized_home_cache WHERE user_id = ?',
    [userId],
  );

  const playlistCounts = await getOne<{ moods_count: number; daily_count: number }>(
    `SELECT
       SUM(CASE WHEN kind = 'mood' THEN 1 ELSE 0 END) as moods_count,
       SUM(CASE WHEN kind = 'daily' THEN 1 ELSE 0 END) as daily_count
     FROM personalized_home_playlists
     WHERE user_id = ?`,
    [userId],
  );

  const isFresh = cache?.generated_for === today
    && Number(playlistCounts?.moods_count || 0) >= MOOD_PLAYLIST_COUNT
    && Number(playlistCounts?.daily_count || 0) >= 1;

  if (!isFresh) {
    await generateHomeCollections(userId);
  }

  const refreshedCache = await getOne<{ generated_for: string | null; featured_artists_json: string | null }>(
    'SELECT generated_for, featured_artists_json FROM personalized_home_cache WHERE user_id = ?',
    [userId],
  );

  const { moodPlaylists, playlistOfDay } = await getStoredPlaylists(userId);
  return {
    generated_for: refreshedCache?.generated_for || today,
    featured_artists: refreshedCache?.featured_artists_json ? JSON.parse(refreshedCache.featured_artists_json) : [],
    mood_playlists: moodPlaylists,
    playlist_of_day: playlistOfDay,
  };
}

router.get('/personalized', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const payload = await ensurePersonalizedHome(req.user!.id);
    res.json(payload);
  } catch (error) {
    console.error('Get personalized home error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
