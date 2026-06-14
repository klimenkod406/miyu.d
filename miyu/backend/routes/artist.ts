
import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { runQuery, getOne, getAll } from '../db';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/auth';
import { enqueueAnalyzeTrackAndForget } from '../services/aiService';

const router = Router();

const uploadDir = path.resolve(process.cwd(), '..', 'uploads/tracks');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: Request, _file: any, cb: (error: Error | null, destination: string) => void) => cb(null, uploadDir),
  filename: (_req: Request, file: any, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

interface Track {
  id: number;
  artist_id: number;
  album_id: number | null;
  title: string;
  duration: number;
  track_number: number | null;
  file_path: string;
  file_path_hd: string | null;
  cover_url: string | null;
  genre: string | null;
  bpm: number | null;
  key: string | null;
  lyrics: string | null;
  is_explicit: number;
  is_premium: number;
  status: string;
  created_at: string;
}

// Search artists by name (used to add co-artists when creating a concert)
router.get('/search', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 1) {
      return res.json([]);
    }
    const limit = Math.min(parseInt(String(req.query.limit || '10')) || 10, 25);
    const artists = await getAll<any>(
      `SELECT id, username, avatar_url
       FROM users
       WHERE role = 'artist' AND username LIKE ?
       ORDER BY username
       LIMIT ?`,
      [`%${q}%`, limit]
    );
    res.json(artists);
  } catch (error) {
    console.error('Search artists error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/tracks', authenticateToken, authorizeRole(['artist', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const tracks = await getAll<any>(
      `SELECT
        t.id, t.title, t.duration, t.file_path, t.cover_url, t.is_explicit, t.is_premium, t.status, t.created_at,
        json_object('id', u.id, 'username', u.username, 'is_verified', u.is_verified, 'is_premium', u.is_premium) as artist,
        json_object('id', a.id, 'title', a.title, 'cover_url', a.cover_url) as album
       FROM tracks t
       JOIN users u ON t.artist_id = u.id
       LEFT JOIN albums a ON t.album_id = a.id
       WHERE t.artist_id = ?
       ORDER BY t.created_at DESC`,
      [req.user!.id]
    );

    const parsedTracks = tracks.map((track: any) => {
      let coverUrl = track.cover_url;
      if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
        coverUrl = `/uploads/tracks/${coverUrl}`;
      }
      let albumCoverUrl = track.album?.cover_url;
      if (albumCoverUrl && !albumCoverUrl.startsWith('http') && !albumCoverUrl.startsWith('/uploads/')) {
        albumCoverUrl = `/uploads/albums/${albumCoverUrl}`;
      }
      return {
        ...track,
        cover_url: coverUrl,
        artist: JSON.parse(track.artist),
        album: track.album ? { ...JSON.parse(track.album), cover_url: albumCoverUrl } : null,
      };
    });

    res.json(parsedTracks);
  } catch (error) {
    console.error('Artist tracks error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/stats', authenticateToken, authorizeRole(['artist', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const totalTracks = await getOne<any>('SELECT COUNT(*) as count FROM tracks WHERE artist_id = ?', [req.user!.id]);
    const totalAlbums = await getOne<any>('SELECT COUNT(*) as count FROM albums WHERE artist_id = ?', [req.user!.id]);
    const totalPlays = await getOne<any>(
      `SELECT COUNT(tp.id) as total FROM track_plays tp 
       JOIN tracks t ON tp.track_id = t.id WHERE t.artist_id = ?`,
      [req.user!.id]
    );
    const totalListeningSeconds = await getOne<any>(
      `SELECT SUM(tp.play_duration) as total FROM track_plays tp 
       JOIN tracks t ON tp.track_id = t.id WHERE t.artist_id = ?`,
      [req.user!.id]
    );
    const artistProfile = await getOne<any>('SELECT total_earnings FROM artist_profiles WHERE user_id = ?', [req.user!.id]);
    const ticketRevenue = await getOne<any>(
      `SELECT SUM(tt.sold * tt.price) as total
       FROM concerts c
       JOIN ticket_types tt ON tt.concert_id = c.id
       WHERE c.artist_id = ?`,
      [req.user!.id],
    );

    res.json({
      totalTracks: totalTracks?.count || 0,
      totalAlbums: totalAlbums?.count || 0,
      totalPlays: totalPlays?.total || 0,
      totalMinutes: Math.round((totalListeningSeconds?.total || 0) / 60),
      balance: Number(artistProfile?.total_earnings || 0),
      ticketRevenueGross: Number(ticketRevenue?.total || 0),
    });
  } catch (error) {
    console.error('Artist stats error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

interface UploadRequest extends AuthRequest {
  files?: any;
}

router.post('/tracks', authenticateToken, authorizeRole(['artist', 'admin']), upload.fields([{ name: 'track', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), async (req: UploadRequest, res: Response) => {
  try {
    const { title, duration, album_id, genre, bpm, key, lyrics, is_explicit, is_premium } = req.body;
    const trackFile = req.files?.['track']?.[0];
    const coverFile = req.files?.['cover']?.[0];

    if (!title || !duration || !trackFile) {
      return res.status(400).json({ error: 'Название, длительность и файл трека обязательны' });
    }
    
    let coverUrl: string | null = null;
    if (coverFile) {
      coverUrl = `/uploads/tracks/${coverFile.filename}`;
    } else if (album_id) {
      const album = await getOne<any>('SELECT cover_url FROM albums WHERE id = ?', [album_id]);
      if (album) {
          coverUrl = album.cover_url;
      }
    }

    const result = await runQuery(
      `INSERT INTO tracks (artist_id, album_id, title, duration, file_path, cover_url, genre, bpm, key, lyrics, is_explicit, is_premium, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        req.user!.id,
        album_id || null,
        title,
        parseInt(duration as string),
        `/uploads/tracks/${trackFile.filename}`,
        coverUrl,
        genre || null,
        bpm ? parseInt(bpm as string) : null,
        key || null,
        lyrics || null,
        is_explicit === 'true' ? 1 : 0,
        is_premium === 'true' ? 1 : 0
      ]
    );

    const track = await getOne<Track>('SELECT * FROM tracks WHERE id = ?', [result.lastID]);

    // Hook: поставить задачу анализа в ai-service (fire-and-forget).
    if (track) {
      enqueueAnalyzeTrackAndForget(track.id, track.file_path);
    }

    res.status(201).json(track);
  } catch (error) {
    console.error('Create track error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/tracks/:id', authenticateToken, authorizeRole(['artist', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const trackId = parseInt(req.params.id as string);
    const { title, genre, bpm, key, lyrics, is_explicit, is_premium } = req.body;

    const track = await getOne<Track>('SELECT * FROM tracks WHERE id = ?', [trackId]);
    if (!track) {
      return res.status(404).json({ error: 'Трек не найден' });
    }

    if (track.artist_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    await runQuery(
      `UPDATE tracks SET title = ?, genre = ?, bpm = ?, key = ?, lyrics = ?, is_explicit = ?, is_premium = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title || track.title,
        genre ?? track.genre,
        bpm ? parseInt(bpm as string) : track.bpm,
        key ?? track.key,
        lyrics ?? track.lyrics,
        is_explicit !== undefined ? (is_explicit ? 1 : 0) : track.is_explicit,
        is_premium !== undefined ? (is_premium ? 1 : 0) : track.is_premium,
        trackId
      ]
    );

    const updatedTrack = await getOne<Track>('SELECT * FROM tracks WHERE id = ?', [trackId]);
    res.json(updatedTrack);
  } catch (error) {
    console.error('Update track error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/tracks/:id', authenticateToken, authorizeRole(['artist', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const trackId = parseInt(req.params.id as string);

    const track = await getOne<Track>('SELECT * FROM tracks WHERE id = ?', [trackId]);
    if (!track) {
      return res.status(404).json({ error: 'Трек не найден' });
    }

    if (track.artist_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    if (track.file_path) {
      const filePath = path.join(__dirname, '../../..', track.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await runQuery('DELETE FROM tracks WHERE id = ?', [trackId]);
    res.json({ message: 'Трек удален' });
  } catch (error) {
    console.error('Delete track error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/concerts', authenticateToken, authorizeRole(['artist']), async (req: AuthRequest, res: Response) => {
  try {
    const artistId = req.user!.id;

    const concerts = await getAll<any>(`
      SELECT 
        c.*,
        (SELECT SUM(tt.sold) FROM ticket_types tt WHERE tt.concert_id = c.id) as ticketsSold,
        (SELECT SUM(tt.sold * tt.price) FROM ticket_types tt WHERE tt.concert_id = c.id) as revenue
      FROM concerts c
      WHERE c.artist_id = ?
      ORDER BY c.event_date DESC
    `, [artistId]);

    const now = new Date();
    const upcomingConcerts: any[] = [];
    const pastConcerts: any[] = [];

    concerts.forEach(c => {
      const concertDate = new Date(c.event_date);
      const coverUrl = c.cover_url
        ? (c.cover_url.startsWith('http') || c.cover_url.startsWith('/uploads/')
            ? c.cover_url
            : `/uploads/concerts/${c.cover_url}`)
        : null;
      const concertData: any = {
        id: c.id,
        title: c.title,
        date: concertDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
        time: c.event_time,
        venue: c.venue,
        city: c.city,
        cover_url: coverUrl,
        moderation_status: c.status, // 'pending' | 'available' | 'rejected' | 'cancelled' | 'completed' | 'soldout'
        status: c.status,
        ticketsSold: c.ticketsSold || 0,
        revenue: c.revenue || 0,
      };
      if (concertDate >= now && c.status !== 'completed' && c.status !== 'cancelled') {
        concertData.status = c.status === 'pending' || c.status === 'rejected' ? c.status : 'upcoming';
        upcomingConcerts.push(concertData);
      } else {
        concertData.status = 'completed';
        pastConcerts.push(concertData);
      }
    });

    const totalTicketsSold = pastConcerts.reduce((sum, c) => sum + c.ticketsSold, 0);
    const totalRevenue = pastConcerts.reduce((sum, c) => sum + c.revenue, 0);

    res.json({
      upcomingConcerts,
      pastConcerts,
      stats: {
        totalConcerts: concerts.length,
        totalUpcoming: upcomingConcerts.length,
        totalTicketsSold: totalTicketsSold,
        totalRevenue: totalRevenue,
        avgTickets: pastConcerts.length > 0 ? Math.round(totalTicketsSold / pastConcerts.length) : 0,
        bestConcertTickets: pastConcerts.length > 0 ? Math.max(...pastConcerts.map(c => c.ticketsSold)) : 0,
      }
    });

  } catch (error) {
    console.error('Artist concerts stats error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
