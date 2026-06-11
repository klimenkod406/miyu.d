import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import adminRoutes from './routes/admin';
import adminUploadRoutes from './routes/admin-upload';
import artistRoutes from './routes/artist';
import artistAlbumsRoutes from './routes/artist-albums';
import albumRoutes from './routes/album';
import trackRoutes from './routes/track';
import moderationRoutes from './routes/moderation';
import likesRoutes from './routes/likes';
import playlistsRoutes from './routes/playlists';
import artistVideosRoutes from './routes/artist-videos';
import videosRoutes from './routes/videos';
import concertRoutes from './routes/concerts';
import userAchievementsRoutes from './routes/user-achievements';
import achievementRoutes from './routes/achievements';
import adminAchievementsRoutes from './routes/admin-achievements';
import friendshipsRoutes from './routes/friendships';
import notificationsRoutes from './routes/notifications';
import followingRoutes from './routes/following';
import transactionsRoutes from './routes/transactions';
import historyRoutes from './routes/history';
import feedRoutes from './routes/feed';
import searchRoutes from './routes/search';
import aiRoutes from './routes/ai';
import recsysRoutes from './routes/recsys';
import homeRoutes from './routes/home';
import supportRoutes from './routes/support';
import { migrate, closeDb } from './db/migrate';
import { getAll } from './db';

const app = express();
const PORT = process.env.PORT || 3001;

function safeParseJson<T>(value: any, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeTrackPath(value: any, prefix: '/uploads/tracks/' | '/uploads/albums/' | '/uploads/avatars/'): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (value.startsWith('http') || value.startsWith('/uploads/') || value.startsWith('data:image/')) return value;
  return `${prefix}${value}`;
}

function isRecord(value: any): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/user/achievements', userAchievementsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminUploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/artist', artistRoutes);
app.use('/api/artist', artistAlbumsRoutes);
app.use('/api/album', albumRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/artist', artistVideosRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/concerts', concertRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/admin/achievements', adminAchievementsRoutes);
app.use('/api/friends', friendshipsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/following', followingRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/recsys', recsysRoutes);
app.use('/api/home', homeRoutes);

app.get('/api/tracks', async (req, res) => {
  try {
    const artistId = req.query.artist_id;

    let query = `
      SELECT
        t.id, t.title, t.artist_id, u.username as artist_name, t.duration, t.file_path, t.cover_url, t.genre, t.is_explicit, t.is_premium, t.status, t.created_at,
        json_object('id', u.id, 'username', u.username, 'is_verified', u.is_verified, 'is_premium', u.is_premium) as artist,
        json_object('id', a.id, 'title', a.title, 'cover_url', a.cover_url) as album
      FROM tracks t
      JOIN users u ON t.artist_id = u.id
      LEFT JOIN albums a ON t.album_id = a.id
      WHERE t.status = 'approved'
    `;

    const params: any[] = [];

    if (artistId) {
      query += ' AND t.artist_id = ?';
      params.push(parseInt(artistId as string));
    }

    query += ' ORDER BY t.created_at DESC LIMIT 50';

    const tracks = await getAll<any>(query, params);

    const parsedTracks = tracks.map((track: any) => {
      const artist = safeParseJson(track.artist, null);
      const album = safeParseJson(track.album, null);
      const safeArtist: Record<string, any> | null = isRecord(artist) ? artist : null;
      const safeAlbum: Record<string, any> | null = isRecord(album) ? album : null;
      const coverUrl = normalizeTrackPath(track.cover_url, '/uploads/tracks/');
      const albumCoverUrl = normalizeTrackPath(safeAlbum ? safeAlbum['cover_url'] : null, '/uploads/albums/');
      return {
        ...track,
        cover_url: coverUrl,
        artist: safeArtist,
        album: safeAlbum && safeAlbum['id'] ? Object.assign({}, safeAlbum, { cover_url: albumCoverUrl }) : null,
      };
    });

    res.json(parsedTracks);
  } catch (error) {
    console.error('Get tracks error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/genres', async (_req, res) => {
  try {
    const genres = await getAll<any>(`
      SELECT genre, COUNT(*) as count
      FROM tracks
      WHERE status = 'approved' AND genre IS NOT NULL AND genre != ''
      GROUP BY genre
      ORDER BY count DESC
      LIMIT 12
    `);
    res.json(genres);
  } catch (error) {
    console.error('Get genres error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/albums', async (req, res) => {
  try {
    const artistId = req.query.artist_id;

    let query = `
      SELECT a.id, a.title, a.artist_id, a.cover_url, a.release_year, a.type, a.status, a.created_at,
             (SELECT COUNT(*) FROM tracks WHERE album_id = a.id) as track_count
      FROM albums a
      WHERE a.status = 'approved'
    `;

    const params: any[] = [];

    if (artistId) {
      query += ' AND a.artist_id = ?';
      params.push(parseInt(artistId as string));
    }

    query += ' ORDER BY a.created_at DESC';

    const albums = await getAll<any>(query, params);

    const parsedAlbums = albums.map((album: any) => {
      let coverUrl = album.cover_url;
      if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
        coverUrl = `/uploads/albums/${coverUrl}`;
      }
      return {
        ...album,
        cover_url: coverUrl,
        release_date: album.release_year ? `${album.release_year}-01-01` : null
      };
    });

    res.json(parsedAlbums);
  } catch (error) {
    console.error('Get albums error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/tracks/popular', async (_req, res) => {
  try {
    const tracks = await getAll<any>(`
      SELECT
        t.id, t.title, t.duration, t.file_path, t.cover_url, t.is_explicit, t.is_premium, t.status, t.created_at,
        json_object('id', u.id, 'username', u.username, 'is_verified', u.is_verified, 'is_premium', u.is_premium) as artist,
        json_object('id', a.id, 'title', a.title, 'cover_url', a.cover_url) as album,
        COALESCE((SELECT COUNT(*) FROM track_plays WHERE track_id = t.id), 0) as play_count
      FROM tracks t
      JOIN users u ON t.artist_id = u.id
      LEFT JOIN albums a ON t.album_id = a.id
      WHERE t.status = 'approved'
      ORDER BY play_count DESC
      LIMIT 50
    `);
    
    const parsedTracks = tracks.map((track: any) => {
      const artist = safeParseJson(track.artist, null);
      const album = safeParseJson(track.album, null);
      const safeArtist: Record<string, any> | null = isRecord(artist) ? artist : null;
      const safeAlbum: Record<string, any> | null = isRecord(album) ? album : null;
      const coverUrl = normalizeTrackPath(track.cover_url, '/uploads/tracks/');
      const albumCoverUrl = normalizeTrackPath(safeAlbum ? safeAlbum['cover_url'] : null, '/uploads/albums/');
      return {
        ...track,
        cover_url: coverUrl,
        artist: safeArtist,
        album: safeAlbum && safeAlbum['id'] ? Object.assign({}, safeAlbum, { cover_url: albumCoverUrl }) : null,
      };
    });
    
    res.json(parsedTracks);
  } catch (error) {
    console.error('Get popular tracks error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/artists/popular', async (_req, res) => {
  try {
    const artists = await getAll<any>(`
      SELECT
        u.id,
        u.username,
        u.avatar_url,
        u.bio,
        u.is_verified,
        u.is_premium,
        COALESCE((SELECT COUNT(*) FROM tracks t WHERE t.artist_id = u.id AND t.status = 'approved'), 0) as track_count,
        COALESCE((
          SELECT COUNT(*)
          FROM track_plays tp
          JOIN tracks t ON t.id = tp.track_id
          WHERE t.artist_id = u.id AND t.status = 'approved'
        ), 0) as play_count
      FROM users u
      WHERE u.role = 'artist'
      ORDER BY play_count DESC, track_count DESC, u.created_at DESC
      LIMIT 12
    `);

    const parsedArtists = artists.map((artist: any) => {
      let avatarUrl = artist.avatar_url;
      if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('/uploads/')) {
        avatarUrl = `/uploads/avatars/${avatarUrl}`;
      }

      return {
        ...artist,
        avatar_url: avatarUrl,
      };
    });

    res.json(parsedArtists);
  } catch (error) {
    console.error('Get popular artists error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await migrate();
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await closeDb();
  process.exit(0);
});

start();
