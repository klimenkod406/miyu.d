
import { Router, Request, Response } from 'express';
import { db, runQuery, getOne, getAll } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const router = Router();

const uploadDir = path.resolve(__dirname, '..', '..', 'uploads/avatars');
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

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

interface User {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: number;
  is_premium: number;
  premium_expires_at: string | null;
  created_at: string;
  is_profile_public?: number;
  show_history?: number;
  show_likes?: number;
  show_achievements?: number;
  show_favorite_artists?: number;
  show_favorite_albums?: number;
  show_playlists?: number;
  show_favorite_tracks?: number;
  palette_mode?: string;
  palette_primary?: string;
  palette_secondary?: string;
  palette_tertiary?: string;
  palette_accent?: string;
  notify_likes?: number;
  notify_follows?: number;
  notify_friend_requests?: number;
  notify_concerts?: number;
  last_seen?: string;
  show_online_status?: number;
  show_listening_status?: number;
  current_track_id?: number | null;
  current_context_type?: string | null;
  current_context_id?: number | null;
  current_context_title?: string | null;
  listening_updated_at?: string | null;
}

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await getOne<User>(
      `SELECT id, email, username, role, avatar_url, bio, is_verified,
              is_premium, premium_expires_at, created_at, is_profile_public,
              show_history, show_likes, show_achievements, show_favorite_artists, show_favorite_albums, show_playlists, show_favorite_tracks,
              palette_mode, palette_primary, palette_secondary, palette_tertiary, palette_accent,
              notify_likes, notify_follows, notify_friend_requests, notify_concerts, show_online_status, show_listening_status
       FROM users WHERE id = ?`,
      [req.user!.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      avatar_url: user.avatar_url,
      bio: user.bio,
      is_verified: !!user.is_verified,
      is_premium: !!user.is_premium,
      premium_expires_at: user.premium_expires_at,
      created_at: user.created_at,
      is_profile_public: !!user.is_profile_public,
      show_history: !!user.show_history,
      show_likes: !!user.show_likes,
      show_achievements: !!user.show_achievements,
      show_favorite_artists: !!user.show_favorite_artists,
      show_favorite_albums: !!user.show_favorite_albums,
      show_playlists: !!user.show_playlists,
      show_favorite_tracks: !!user.show_favorite_tracks,
      palette_mode: user.palette_mode || 'auto',
      palette_primary: user.palette_primary,
      palette_secondary: user.palette_secondary,
      palette_tertiary: user.palette_tertiary,
      palette_accent: user.palette_accent,
      notify_likes: !!user.notify_likes,
      notify_follows: !!user.notify_follows,
      notify_friend_requests: !!user.notify_friend_requests,
      notify_concerts: !!user.notify_concerts,
      show_online_status: user.show_online_status !== undefined ? !!user.show_online_status : true,
      show_listening_status: user.show_listening_status !== undefined ? !!user.show_listening_status : true,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);
    console.log('=== Loading user by ID:', userId, '===');
    const user = await getOne<any>(
      `SELECT u.id, u.username, u.role, u.avatar_url, u.bio, u.is_verified,
               is_premium, created_at, is_profile_public, show_history, show_likes,
               show_achievements, show_favorite_artists, show_favorite_albums, show_playlists, show_favorite_tracks,
               palette_mode, palette_primary, palette_secondary, palette_tertiary, palette_accent,
               COALESCE(ap.total_earnings, 0) as total_earnings,
               COALESCE((
                 SELECT SUM(tt.sold * tt.price)
                 FROM concerts c
                 JOIN ticket_types tt ON tt.concert_id = c.id
                 WHERE c.artist_id = u.id
               ), 0) as ticket_revenue_gross
       FROM users u
       LEFT JOIN artist_profiles ap ON ap.user_id = u.id
       WHERE u.id = ?`,
      [userId]
    );

    if (!user) {
      console.log('User not found:', userId);
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    console.log('User found:', user);
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      avatar_url: user.avatar_url,
      bio: user.bio,
      is_verified: !!user.is_verified,
      is_premium: !!user.is_premium,
      created_at: user.created_at,
      is_profile_public: !!user.is_profile_public,
      show_history: !!user.show_history,
      show_likes: !!user.show_likes,
      show_achievements: !!user.show_achievements,
      show_favorite_artists: !!user.show_favorite_artists,
      show_favorite_albums: !!user.show_favorite_albums,
      show_playlists: !!user.show_playlists,
      show_favorite_tracks: !!user.show_favorite_tracks,
      palette_mode: user.palette_mode || 'auto',
      palette_primary: user.palette_primary,
      palette_secondary: user.palette_secondary,
      palette_tertiary: user.palette_tertiary,
      palette_accent: user.palette_accent,
      total_earnings: Number(user.total_earnings || 0),
      ticket_revenue_gross: Number(user.ticket_revenue_gross || 0),
    });
  } catch (error: any) {
    console.error('Get user by ID error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

router.post('/me/avatar', authenticateToken, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const avatarFile = req.file;

    if (!avatarFile) {
      return res.status(400).json({ error: 'Файл аватара обязателен' });
    }

    const avatarUrl = `/uploads/avatars/${avatarFile.filename}`;

    await runQuery('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);

    res.json({ avatar_url: avatarUrl });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { username, bio, avatar_url, is_profile_public, show_history, show_likes, show_achievements, show_favorite_artists, show_favorite_albums, show_playlists, show_favorite_tracks, palette_mode, palette_primary, palette_secondary, palette_tertiary, palette_accent, notify_likes, notify_follows, notify_friend_requests, notify_concerts, show_online_status, show_listening_status } = req.body;
    const userId = req.user!.id;

    if (username) {
      const existing = await getOne<User>('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
      if (existing) {
        return res.status(400).json({ error: 'Имя пользователя уже занято' });
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (username) {
      updates.push('username = ?');
      values.push(username);
    }
    if (bio !== undefined) {
      updates.push('bio = ?');
      values.push(bio);
    }
    if (avatar_url !== undefined) {
      updates.push('avatar_url = ?');
      values.push(avatar_url);
    }
    if (is_profile_public !== undefined) {
      updates.push('is_profile_public = ?');
      values.push(is_profile_public ? 1 : 0);
    }
    if (show_history !== undefined) {
      updates.push('show_history = ?');
      values.push(show_history ? 1 : 0);
    }
    if (show_likes !== undefined) {
      updates.push('show_likes = ?');
      values.push(show_likes ? 1 : 0);
    }
    if (show_achievements !== undefined) {
      updates.push('show_achievements = ?');
      values.push(show_achievements ? 1 : 0);
    }
    if (show_favorite_artists !== undefined) {
      updates.push('show_favorite_artists = ?');
      values.push(show_favorite_artists ? 1 : 0);
    }
    if (show_favorite_albums !== undefined) {
      updates.push('show_favorite_albums = ?');
      values.push(show_favorite_albums ? 1 : 0);
    }
    if (show_playlists !== undefined) {
      updates.push('show_playlists = ?');
      values.push(show_playlists ? 1 : 0);
    }
    if (show_favorite_tracks !== undefined) {
      updates.push('show_favorite_tracks = ?');
      values.push(show_favorite_tracks ? 1 : 0);
    }
    if (palette_mode !== undefined) {
      updates.push('palette_mode = ?');
      values.push(palette_mode);
    }
    if (palette_primary !== undefined) {
      updates.push('palette_primary = ?');
      values.push(palette_primary);
    }
    if (palette_secondary !== undefined) {
      updates.push('palette_secondary = ?');
      values.push(palette_secondary);
    }
    if (palette_tertiary !== undefined) {
      updates.push('palette_tertiary = ?');
      values.push(palette_tertiary);
    }
    if (palette_accent !== undefined) {
      updates.push('palette_accent = ?');
      values.push(palette_accent);
    }
    if (notify_likes !== undefined) {
      updates.push('notify_likes = ?');
      values.push(notify_likes ? 1 : 0);
    }
    if (notify_follows !== undefined) {
      updates.push('notify_follows = ?');
      values.push(notify_follows ? 1 : 0);
    }
    if (notify_friend_requests !== undefined) {
      updates.push('notify_friend_requests = ?');
      values.push(notify_friend_requests ? 1 : 0);
    }
    if (notify_concerts !== undefined) {
      updates.push('notify_concerts = ?');
      values.push(notify_concerts ? 1 : 0);
    }
    if (show_online_status !== undefined) {
      updates.push('show_online_status = ?');
      values.push(show_online_status ? 1 : 0);
    }

    if (show_listening_status !== undefined) {
      updates.push('show_listening_status = ?');
      values.push(show_listening_status ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нечего обновлять' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    await runQuery(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const user = await getOne<User>(
      `SELECT id, email, username, role, avatar_url, bio, is_verified,
              is_premium, premium_expires_at, created_at, is_profile_public,
              show_history, show_likes, show_achievements, show_favorite_artists, show_favorite_albums, show_playlists, show_favorite_tracks,
              palette_mode, palette_primary, palette_secondary, palette_tertiary, palette_accent,
              notify_likes, notify_follows, notify_friend_requests, notify_concerts
       FROM users WHERE id = ?`,
      [userId]
    );

    res.json({
      id: user!.id,
      email: user!.email,
      username: user!.username,
      role: user!.role,
      avatar_url: user!.avatar_url,
      bio: user!.bio,
      is_verified: !!user!.is_verified,
      is_premium: !!user!.is_premium,
      premium_expires_at: user!.premium_expires_at,
      created_at: user!.created_at,
      is_profile_public: !!user!.is_profile_public,
      show_history: !!user!.show_history,
      show_likes: !!user!.show_likes,
      show_achievements: !!user!.show_achievements,
      show_favorite_artists: !!user!.show_favorite_artists,
      show_favorite_albums: !!user!.show_favorite_albums,
      show_playlists: !!user!.show_playlists,
      show_favorite_tracks: !!user!.show_favorite_tracks,
      palette_mode: user!.palette_mode || 'auto',
      palette_primary: user!.palette_primary,
      palette_secondary: user!.palette_secondary,
      palette_tertiary: user!.palette_tertiary,
      palette_accent: user!.palette_accent,
      notify_likes: !!user!.notify_likes,
      notify_follows: !!user!.notify_follows,
      notify_friend_requests: !!user!.notify_friend_requests,
      notify_concerts: !!user!.notify_concerts
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/me/tickets', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tickets = await getAll<any>(`
      SELECT
        t.id as ticket_id, t.qr_code, t.status as ticket_status, t.purchased_at,
        tt.name as ticket_type_name, tt.price,
        c.id as concert_id, c.title as concert_title, c.venue, c.city, c.event_date, c.event_time, c.cover_url,
        json_object('id', a.id, 'name', a.username, 'avatar_url', a.avatar_url) as artist
      FROM tickets t
      JOIN ticket_types tt ON t.ticket_type_id = tt.id
      JOIN concerts c ON tt.concert_id = c.id
      JOIN users a ON c.artist_id = a.id
      WHERE t.user_id = ?
      ORDER BY c.event_date DESC
    `, [userId]);

    const parsedTickets = tickets.map((ticket: any) => ({
      ...ticket,
      cover_url: ticket.cover_url
        ? (ticket.cover_url.startsWith('http') || ticket.cover_url.startsWith('/uploads/')
            ? ticket.cover_url
            : `/uploads/concerts/${ticket.cover_url}`)
        : null,
      artist: JSON.parse(ticket.artist)
    }));

    res.json(parsedTickets);
  } catch (error) {
    console.error('Get user tickets error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/me/favorite-artists', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const favoriteArtists = await getAll<any>(`
      SELECT
        u.id,
        u.username,
        u.avatar_url,
        u.bio,
        u.is_verified,
        u.is_premium,
        ap.stage_name,
        ap.genre,
        ap.total_plays,
        SUM(tp.play_duration) as listened_seconds
      FROM track_plays tp
      JOIN tracks t ON tp.track_id = t.id
      JOIN users u ON t.artist_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      WHERE tp.user_id = ?
      GROUP BY u.id
      HAVING SUM(tp.play_duration) >= 7200
      ORDER BY listened_seconds DESC, u.username ASC
    `, [userId]);

    res.json(favoriteArtists.map((artist: any) => ({
      id: artist.id,
      username: artist.username,
      avatar_url: artist.avatar_url,
      bio: artist.bio,
      is_verified: !!artist.is_verified,
      is_premium: !!artist.is_premium,
      stage_name: artist.stage_name,
      genre: artist.genre,
      total_plays: artist.total_plays || 0,
      listened_seconds: artist.listened_seconds || 0,
    })));
  } catch (error) {
    console.error('Get favorite artists error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/me/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const days = Math.max(7, Math.min(365, parseInt(String(req.query.days || '30'), 10) || 30));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const since = startDate.toISOString();

    const [summary, playsByDay, topArtists, topGenres, topTracks, recentActivity] = await Promise.all([
      getOne<any>(`
        SELECT
          COALESCE(SUM(tp.play_duration), 0) as total_minutes_raw,
          COUNT(tp.id) as total_plays,
          COUNT(DISTINCT t.artist_id) as artists_count,
          COUNT(DISTINCT tp.track_id) as tracks_count,
          COUNT(DISTINCT DATE(tp.created_at)) as active_days,
          COALESCE((SELECT COUNT(*) FROM likes WHERE user_id = ?), 0) as likes_count,
          COALESCE((SELECT COUNT(*) FROM follows WHERE follower_id = ?), 0) as following_count,
          COALESCE((SELECT COUNT(*) FROM playlists WHERE user_id = ? AND is_system = 0), 0) as playlists_count,
          COALESCE((
            SELECT COUNT(*)
            FROM (
              SELECT t2.artist_id
              FROM track_plays tp2
              JOIN tracks t2 ON tp2.track_id = t2.id
              WHERE tp2.user_id = ?
              GROUP BY t2.artist_id
              HAVING SUM(tp2.play_duration) >= 7200
            ) fav
          ), 0) as favorite_artists_count
        FROM track_plays tp
        JOIN tracks t ON tp.track_id = t.id
        WHERE tp.user_id = ? AND tp.created_at >= ?
      `, [userId, userId, userId, userId, userId, since]),

      getAll<any>(`
        SELECT DATE(created_at) as date, COUNT(*) as plays, COALESCE(SUM(play_duration), 0) as minutes
        FROM track_plays
        WHERE user_id = ? AND created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY date
      `, [userId, since]),

      getAll<any>(`
        SELECT u.id, u.username, u.avatar_url, u.is_verified, COUNT(tp.id) as plays, COALESCE(SUM(tp.play_duration), 0) as listened_seconds
        FROM track_plays tp
        JOIN tracks t ON tp.track_id = t.id
        JOIN users u ON t.artist_id = u.id
        WHERE tp.user_id = ? AND tp.created_at >= ?
        GROUP BY u.id
        ORDER BY listened_seconds DESC, plays DESC
        LIMIT 8
      `, [userId, since]),

      getAll<any>(`
        SELECT COALESCE(NULLIF(t.genre, ''), 'Без жанра') as genre, COUNT(tp.id) as plays, COALESCE(SUM(tp.play_duration), 0) as listened_seconds
        FROM track_plays tp
        JOIN tracks t ON tp.track_id = t.id
        WHERE tp.user_id = ? AND tp.created_at >= ?
        GROUP BY genre
        ORDER BY listened_seconds DESC, plays DESC
        LIMIT 8
      `, [userId, since]),

      getAll<any>(`
        SELECT t.id, t.title, u.username as artist_name, COUNT(tp.id) as plays, COALESCE(SUM(tp.play_duration), 0) as listened_seconds
        FROM track_plays tp
        JOIN tracks t ON tp.track_id = t.id
        JOIN users u ON t.artist_id = u.id
        WHERE tp.user_id = ? AND tp.created_at >= ?
        GROUP BY t.id
        ORDER BY listened_seconds DESC, plays DESC
        LIMIT 10
      `, [userId, since]),

      getAll<any>(`
        SELECT tp.created_at, t.title, u.username as artist_name, tp.play_duration
        FROM track_plays tp
        JOIN tracks t ON tp.track_id = t.id
        JOIN users u ON t.artist_id = u.id
        WHERE tp.user_id = ? AND tp.created_at >= ?
        ORDER BY tp.created_at DESC
        LIMIT 8
      `, [userId, since]),
    ]);

    res.json({
      period_days: days,
      summary: {
        total_minutes: Math.round(Number(summary?.total_minutes_raw || 0) / 60),
        total_plays: Number(summary?.total_plays || 0),
        artists_count: Number(summary?.artists_count || 0),
        tracks_count: Number(summary?.tracks_count || 0),
        active_days: Number(summary?.active_days || 0),
        likes_count: Number(summary?.likes_count || 0),
        following_count: Number(summary?.following_count || 0),
        playlists_count: Number(summary?.playlists_count || 0),
        favorite_artists_count: Number(summary?.favorite_artists_count || 0),
      },
      playsByDay,
      topArtists,
      topGenres,
      topTracks,
      recentActivity,
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/me/artist-application', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const application = await getOne<any>(
      `SELECT id, type, message, links, reason, status, reviewed_at, created_at, updated_at
       FROM artist_applications
       WHERE user_id = ?`,
      [req.user!.id],
    );

    res.json(application || null);
  } catch (error) {
    console.error('Get artist application error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/me/artist-application', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const type = String(req.body?.type || 'create').trim();
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const links = typeof req.body?.links === 'string' ? req.body.links.trim() : '';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!['create', 'delete'].includes(type)) {
      return res.status(400).json({ error: 'Неверный тип заявки' });
    }

    const user = await getOne<any>('SELECT role, password_hash FROM users WHERE id = ?', [userId]);
    if (type === 'create' && user?.role === 'artist') {
      return res.status(400).json({ error: 'У вас уже есть страница артиста' });
    }
    if (type === 'delete' && user?.role !== 'artist') {
      return res.status(400).json({ error: 'Удаление доступно только для существующей страницы артиста' });
    }
    if (type === 'delete') {
      if (!password || !reason) {
        return res.status(400).json({ error: 'Для удаления страницы нужно указать пароль и причину' });
      }
      const matches = await bcrypt.compare(password, user.password_hash);
      if (!matches) {
        return res.status(400).json({ error: 'Неверный пароль' });
      }
    }

    const existing = await getOne<any>('SELECT id, status FROM artist_applications WHERE user_id = ?', [userId]);
    if (existing?.status === 'pending') {
      return res.status(400).json({ error: 'Заявка уже отправлена и ожидает рассмотрения' });
    }

    if (existing) {
      await runQuery(
        `UPDATE artist_applications
         SET type = ?, message = ?, links = ?, reason = ?, status = 'pending', reviewed_by = NULL, reviewed_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [type, message || null, links || null, reason || null, userId],
      );
    } else {
      await runQuery(
        `INSERT INTO artist_applications (user_id, type, message, links, reason, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [userId, type, message || null, links || null, reason || null],
      );
    }

    const application = await getOne<any>(
      `SELECT id, type, message, links, reason, status, reviewed_at, created_at, updated_at
       FROM artist_applications
       WHERE user_id = ?`,
      [userId],
    );

    res.status(201).json(application);
  } catch (error) {
    console.error('Create artist application error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/me/tickets/concert/:concertId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const concertId = parseInt(req.params.concertId as string);

    const concert = await getOne<any>(`
      SELECT
        c.id, c.title, c.venue, c.city, c.country, c.address,
        c.event_date, c.event_time, c.cover_url,
        json_object('id', a.id, 'name', a.username, 'avatar_url', a.avatar_url) as artist
      FROM concerts c
      JOIN users a ON c.artist_id = a.id
      WHERE c.id = ?
    `, [concertId]);

    if (!concert) {
      return res.status(404).json({ error: 'Концерт не найден' });
    }

    const tickets = await getAll<any>(`
      SELECT
        t.id as ticket_id, t.qr_code, t.status as ticket_status, t.purchased_at,
        t.seat_row, t.seat_number,
        tt.name as ticket_type_name, tt.price, tt.zone_id
      FROM tickets t
      JOIN ticket_types tt ON t.ticket_type_id = tt.id
      WHERE t.user_id = ? AND tt.concert_id = ?
      ORDER BY t.purchased_at ASC
    `, [userId, concertId]);

    if (tickets.length === 0) {
      return res.status(404).json({ error: 'У вас нет билетов на этот концерт' });
    }

    res.json({
      concert: {
        ...concert,
        cover_url: concert.cover_url
          ? (concert.cover_url.startsWith('http') || concert.cover_url.startsWith('/uploads/')
              ? concert.cover_url
              : `/uploads/concerts/${concert.cover_url}`)
          : null,
        artist: JSON.parse(concert.artist),
      },
      tickets,
    });
  } catch (error) {
    console.error('Get tickets for concert error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/me/tickets/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const ticketId = req.params.id;

    const ticket = await getOne<any>(`
      SELECT
        t.id as ticket_id, t.qr_code, t.status as ticket_status, t.purchased_at,
        t.seat_row, t.seat_number,
        tt.name as ticket_type_name, tt.price,
        c.id as concert_id, c.title as concert_title, c.venue, c.city, c.country, c.address,
        c.event_date, c.event_time, c.cover_url,
        json_object('id', a.id, 'name', a.username, 'avatar_url', a.avatar_url) as artist
      FROM tickets t
      JOIN ticket_types tt ON t.ticket_type_id = tt.id
      JOIN concerts c ON tt.concert_id = c.id
      JOIN users a ON c.artist_id = a.id
      WHERE t.id = ? AND t.user_id = ?
    `, [ticketId, userId]);

    if (!ticket) {
      return res.status(404).json({ error: 'Билет не найден' });
    }

    const parsedTicket = {
      ...ticket,
      cover_url: ticket.cover_url
        ? (ticket.cover_url.startsWith('http') || ticket.cover_url.startsWith('/uploads/')
            ? ticket.cover_url
            : `/uploads/concerts/${ticket.cover_url}`)
        : null,
      artist: JSON.parse(ticket.artist)
    };

    res.json(parsedTicket);
  } catch (error) {
    console.error('Get ticket by id error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:userId/followers', async (req, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'Не указан пользователь' });
    }

    const followers = await getAll<any>(`
      SELECT u.id, u.username, u.avatar_url, u.bio, u.is_verified, u.is_premium, u.role, u.created_at,
             ap.stage_name, ap.genre, ap.total_plays
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      WHERE f.following_id = ?
      ORDER BY f.created_at DESC
    `, [userId]);

    res.json(followers.map((u: any) => ({
      id: u.id,
      username: u.username,
      avatar_url: u.avatar_url,
      bio: u.bio,
      is_verified: !!u.is_verified,
      is_premium: !!u.is_premium,
      role: u.role,
      created_at: u.created_at,
      stage_name: u.stage_name,
      genre: u.genre,
      total_plays: u.total_plays
    })));
  } catch (error) {
    console.error('Get user followers error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:userId/following', async (req, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'Не указан пользователь' });
    }

    const following = await getAll<any>(`
      SELECT u.id, u.username, u.avatar_url, u.bio, u.is_verified, u.is_premium, u.role, u.created_at,
             ap.stage_name, ap.genre, ap.total_plays
      FROM follows f
      JOIN users u ON f.following_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC
    `, [userId]);

    res.json(following.map((u: any) => ({
      id: u.id,
      username: u.username,
      avatar_url: u.avatar_url,
      bio: u.bio,
      is_verified: !!u.is_verified,
      is_premium: !!u.is_premium,
      role: u.role,
      created_at: u.created_at,
      stage_name: u.stage_name,
      genre: u.genre,
      total_plays: u.total_plays
    })));
  } catch (error) {
    console.error('Get user following error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:userId/count', async (req, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'Не указан пользователь' });
    }

    const followingCount = await getOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM follows WHERE follower_id = ?',
      [userId]
    );
    const followersCount = await getOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM follows WHERE following_id = ?',
      [userId]
    );

    res.json({
      following: followingCount?.count || 0,
      followers: followersCount?.count || 0
    });
  } catch (error) {
    console.error('Get user counts error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:userId/achievements', async (req, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'Не указан пользователь' });
    }

    const userAchievements = await getAll<any>(`
      SELECT achievement_id, unlocked_at
      FROM user_achievements
      WHERE user_id = ?
    `, [userId]);

    const unlockedMap = new Map(userAchievements.map((ua: any) => [ua.achievement_id, ua.unlocked_at]));

    const showcase = await getAll<any>(`
      SELECT achievement_id
      FROM achievement_showcase
      WHERE user_id = ?
    `, [userId]);

    const showcaseIds = new Set(showcase.map((s: any) => s.achievement_id));

    const achievements = await getAll<any>(`
      SELECT 
        a.id, a.code, a.title, a.description, a.icon, 
        a.requirement_type, a.requirement_value, a.is_secret, a.rarity,
        (SELECT COUNT(*) FROM user_achievements WHERE achievement_id = a.id) as unlock_count,
        (SELECT COUNT(*) FROM users) as total_users
      FROM achievements a
      WHERE a.is_secret = 0 OR EXISTS (
        SELECT 1 FROM user_achievements ua 
        WHERE ua.achievement_id = a.id AND ua.user_id = ?
      )
      ORDER BY a.id
    `, [userId]);

    const totalUsers = await getOne<{count: number}>(`SELECT COUNT(*) as count FROM users`);
    const total = totalUsers?.count || 1;

    const result = achievements.map((ach: any) => {
      const unlockedAt = unlockedMap.get(ach.id);
      return {
        ...ach,
        unlocked: !!unlockedAt,
        unlocked_at: unlockedAt,
        in_showcase: showcaseIds.has(ach.id),
        unlock_count: ach.unlock_count || 0,
        unlock_percentage: Math.round((ach.unlock_count / total) * 100)
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get user achievements error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Update last_seen timestamp (heartbeat)
router.post('/heartbeat', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date().toISOString();
    const currentTrackId = Number.isFinite(Number(req.body?.currentTrackId)) ? Number(req.body.currentTrackId) : null;
    const currentContextType = typeof req.body?.currentContextType === 'string' ? req.body.currentContextType : null;
    const currentContextId = Number.isFinite(Number(req.body?.currentContextId)) ? Number(req.body.currentContextId) : null;
    const currentContextTitle = typeof req.body?.currentContextTitle === 'string' ? req.body.currentContextTitle : null;

    await runQuery(
      `UPDATE users
       SET last_seen = ?,
           current_track_id = ?,
           current_context_type = ?,
           current_context_id = ?,
           current_context_title = ?,
           listening_updated_at = ?
       WHERE id = ?`,
      [now, currentTrackId, currentContextType, currentContextId, currentContextTitle, currentTrackId ? now : null, req.user!.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/presence-status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.json({});
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const placeholders = userIds.map(() => '?').join(',');
    const users = await getAll<any>(
      `SELECT u.id, u.last_seen, u.show_online_status, u.show_listening_status,
              u.current_context_type, u.current_context_id, u.current_context_title, u.listening_updated_at,
              t.id as track_id, t.title as track_title, t.cover_url as track_cover_url, t.artist_id as track_artist_id,
              artist.username as artist_username,
              a.id as album_id, a.title as album_title, a.cover_url as album_cover_url
       FROM users u
       LEFT JOIN tracks t ON t.id = u.current_track_id
       LEFT JOIN users artist ON artist.id = t.artist_id
       LEFT JOIN albums a ON a.id = t.album_id
       WHERE u.id IN (${placeholders})`,
      userIds,
    );

    const presenceMap: Record<number, any> = {};
    users.forEach((user: any) => {
      const isOnline = Boolean(user.show_online_status) && !!user.last_seen && user.last_seen > fiveMinutesAgo;
      const canShowListening = isOnline && Boolean(user.show_listening_status) && !!user.track_id && !!user.listening_updated_at && user.listening_updated_at > fiveMinutesAgo;
      presenceMap[user.id] = {
        isOnline,
        listeningTo: canShowListening
          ? {
              type: user.current_context_type === 'album' ? 'album' : user.current_context_type === 'playlist' ? 'playlist' : 'track',
              track: {
                id: user.track_id,
                title: user.track_title,
                cover_url: user.track_cover_url,
                artist_id: user.track_artist_id,
                artist: user.artist_username ? { id: user.track_artist_id, username: user.artist_username } : undefined,
                album: user.album_id ? { id: user.album_id, title: user.album_title, cover_url: user.album_cover_url } : undefined,
              },
              context: user.current_context_type && user.current_context_type !== 'wave'
                ? {
                    type: user.current_context_type,
                    id: user.current_context_id,
                    title: user.current_context_title,
                  }
                : null,
            }
          : null,
      };
    });

    res.json(presenceMap);
  } catch (error) {
    console.error('Get presence status error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Get online status of multiple users
router.post('/online-status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.json({});
    }

    // User is online if last_seen is within last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const placeholders = userIds.map(() => '?').join(',');
    const users = await getAll<any>(
      `SELECT id, last_seen, show_online_status
       FROM users
       WHERE id IN (${placeholders})`,
      userIds
    );

    const statusMap: { [key: number]: boolean } = {};
    users.forEach((user: any) => {
      // Only show online status if user allows it
      if (user.show_online_status) {
        statusMap[user.id] = user.last_seen && user.last_seen > fiveMinutesAgo;
      } else {
        statusMap[user.id] = false;
      }
    });

    res.json(statusMap);
  } catch (error) {
    console.error('Get online status error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
