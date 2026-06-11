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
