
import { Router, Response, Request } from 'express';
import { runQuery, getOne, getAll } from '../db';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/auth';
import { createNotification } from './notifications';
import fs from 'fs';
import path from 'path';

const router = Router();

// GET /tracks/counts — счётчики для бейджей фильтров.
router.get('/tracks/counts', authenticateToken, authorizeRole(['admin', 'moderator']), async (_req: AuthRequest, res: Response) => {
  try {
    const all = await getOne<any>(`
      SELECT COUNT(*) as cnt
      FROM tracks t
      LEFT JOIN moderation_queue mq ON mq.content_type='track' AND mq.content_id=t.id
      WHERE t.status='pending' OR (mq.status='ai_flagged' AND t.status NOT IN ('approved','rejected'))
    `);
    const flagged = await getOne<any>(`
      SELECT COUNT(*) as cnt
      FROM tracks t
      JOIN moderation_queue mq ON mq.content_type='track' AND mq.content_id=t.id
      WHERE mq.status='ai_flagged' AND t.status NOT IN ('approved','rejected')
    `);
    const pending = await getOne<any>(`
      SELECT COUNT(*) as cnt FROM tracks t
      LEFT JOIN moderation_queue mq ON mq.content_type='track' AND mq.content_id=t.id
      WHERE t.status='pending' AND (mq.status IS NULL OR mq.status != 'ai_flagged')
    `);
    const flagBreakdown = await getAll<any>(`
      SELECT ta.ai_flags
      FROM tracks t
      LEFT JOIN track_analysis ta ON ta.track_id=t.id
      LEFT JOIN moderation_queue mq ON mq.content_type='track' AND mq.content_id=t.id
      WHERE (t.status='pending' OR mq.status='ai_flagged') AND t.status NOT IN ('approved','rejected')
        AND ta.ai_flags IS NOT NULL
    `);
    const flagCounts: Record<string, number> = {};
    for (const row of flagBreakdown) {
      try {
        const flags: string[] = JSON.parse(row.ai_flags) || [];
        for (const f of flags) flagCounts[f] = (flagCounts[f] || 0) + 1;
      } catch { /* skip */ }
    }
    res.json({
      all: all?.cnt || 0,
      pending: pending?.cnt || 0,
      ai_flagged: flagged?.cnt || 0,
      flags: flagCounts,
    });
  } catch (error) {
    console.error('Moderation counts error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /tracks/pending — фильтры: status / flag / sort / q.
router.get('/tracks/pending', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const status = String(req.query.status || 'all'); // all | pending | ai_flagged
    const flag = String(req.query.flag || '').trim();
    const sort = String(req.query.sort || 'priority'); // priority | recent | score
    const q = String(req.query.q || '').trim();

    const where: string[] = [];
    const params: any[] = [];
    if (status === 'pending') {
      where.push(`t.status='pending' AND (mq.status IS NULL OR mq.status != 'ai_flagged')`);
    } else if (status === 'ai_flagged') {
      where.push(`mq.status='ai_flagged' AND t.status NOT IN ('approved','rejected')`);
    } else {
      where.push(`(t.status='pending' OR (mq.status='ai_flagged' AND t.status NOT IN ('approved','rejected')))`);
    }
    if (flag) {
      // ai_flags хранится как JSON — ищем подстроку "<flag>"
      where.push(`ta.ai_flags LIKE ?`);
      params.push(`%"${flag}"%`);
    }
    if (q) {
      where.push(`(t.title LIKE ? OR u.username LIKE ?)`);
      params.push(`%${q}%`, `%${q}%`);
    }

    let orderBy: string;
    switch (sort) {
      case 'recent': orderBy = `t.created_at DESC`; break;
      case 'score': orderBy = `ta.ai_score DESC NULLS LAST, t.created_at DESC`; break;
      case 'priority':
      default:
        orderBy = `CASE mq.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, ta.ai_score DESC, t.created_at DESC`;
    }

    const tracks = await getAll<any>(
      `SELECT
        t.*,
        u.username as artist_name,
        u.is_verified as artist_is_verified,
        a.title as album_title,
        a.id as album_id,
        ta.ai_score, ta.ai_flags, ta.mood_tags, ta.genre_tags,
        ta.bpm as ai_bpm, ta.key as ai_key,
        ta.danceability, ta.energy, ta.valence,
        ta.acousticness, ta.instrumentalness, ta.speechiness, ta.loudness,
        ta.lyrics_text, ta.lyrics_language, ta.analysis_summary,
        ta.analysis_version, ta.fingerprint, ta.updated_at as analysis_updated_at,
        mq.priority as moderation_priority,
        mq.status as moderation_status
       FROM tracks t
       JOIN users u ON t.artist_id = u.id
       LEFT JOIN albums a ON t.album_id = a.id
       LEFT JOIN track_analysis ta ON ta.track_id = t.id
       LEFT JOIN moderation_queue mq ON mq.content_type = 'track' AND mq.content_id = t.id
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT 100`,
      params
    );

    // Парсим JSON-поля, нормализуем cover_url.
    const parsed = tracks.map((t: any) => {
      let coverUrl = t.cover_url;
      if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
        coverUrl = `/uploads/tracks/${coverUrl}`;
      }
      let filePath = t.file_path;
      if (filePath && !filePath.startsWith('http') && !filePath.startsWith('/uploads/')) {
        filePath = `/uploads/tracks/${filePath}`;
      }
      let aiFlags: any[] = [];
      if (t.ai_flags) {
        try { aiFlags = JSON.parse(t.ai_flags); } catch { aiFlags = []; }
      }
      let genreTags: any[] = [];
      if (t.genre_tags) {
        try { genreTags = JSON.parse(t.genre_tags); } catch { genreTags = []; }
      }
      const moodTags = t.mood_tags ? String(t.mood_tags).split(',').filter(Boolean) : [];
      return {
        ...t,
        cover_url: coverUrl,
        file_path: filePath,
        ai_flags: aiFlags,
        genre_tags: genreTags,
        mood_tags: moodTags,
      };
    });

    res.json(parsed);
  } catch (error) {
    console.error('Moderation tracks error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /tracks/approved — архив одобренных треков с источником одобрения.
router.get('/tracks/approved', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    const where: string[] = [`t.status='approved'`];
    const params: any[] = [];

    if (q) {
      where.push(`(t.title LIKE ? OR u.username LIKE ?)`);
      params.push(`%${q}%`, `%${q}%`);
    }

    const tracks = await getAll<any>(
      `SELECT
        t.*,
        u.username as artist_name,
        u.is_verified as artist_is_verified,
        a.title as album_title,
        a.id as album_id,
        ta.ai_score, ta.ai_flags, ta.mood_tags, ta.genre_tags,
        ta.bpm as ai_bpm, ta.key as ai_key,
        ta.danceability, ta.energy, ta.valence,
        ta.acousticness, ta.instrumentalness, ta.speechiness, ta.loudness,
        ta.lyrics_text, ta.lyrics_language, ta.analysis_summary,
        ta.analysis_version, ta.fingerprint, ta.updated_at as analysis_updated_at,
        mq.priority as moderation_priority,
        mq.status as moderation_status,
        mq.reviewed_by as approved_by_id,
        mq.reviewed_at as approved_at,
        mq.review_comment as approval_comment,
        reviewer.username as approved_by_username
       FROM tracks t
       JOIN users u ON t.artist_id = u.id
       LEFT JOIN albums a ON a.id = t.album_id
       LEFT JOIN track_analysis ta ON ta.track_id = t.id
       LEFT JOIN moderation_queue mq ON mq.content_type = 'track' AND mq.content_id = t.id
       LEFT JOIN users reviewer ON reviewer.id = mq.reviewed_by
       WHERE ${where.join(' AND ')}
       ORDER BY COALESCE(mq.reviewed_at, t.updated_at, t.created_at) DESC
       LIMIT 100`,
      params,
    );

    const parsed = tracks.map((t: any) => {
      let coverUrl = t.cover_url;
      if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
        coverUrl = `/uploads/tracks/${coverUrl}`;
      }
      let filePath = t.file_path;
      if (filePath && !filePath.startsWith('http') && !filePath.startsWith('/uploads/')) {
        filePath = `/uploads/tracks/${filePath}`;
      }
      let aiFlags: any[] = [];
      if (t.ai_flags) {
        try { aiFlags = JSON.parse(t.ai_flags); } catch { aiFlags = []; }
      }
      let genreTags: any[] = [];
      if (t.genre_tags) {
        try { genreTags = JSON.parse(t.genre_tags); } catch { genreTags = []; }
      }
      const moodTags = t.mood_tags ? String(t.mood_tags).split(',').filter(Boolean) : [];
      const approvedByType = t.approved_by_id ? 'moderator' : 'ai';
      return {
        ...t,
        cover_url: coverUrl,
        file_path: filePath,
        ai_flags: aiFlags,
        genre_tags: genreTags,
        mood_tags: moodTags,
        approved_by_type: approvedByType,
      };
    });

    res.json(parsed);
  } catch (error) {
    console.error('Moderation approved tracks error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /tracks/:id/history — таймлайн решений по треку (AI + модераторы).
router.get('/tracks/:id/history', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const trackId = parseInt(req.params.id as string);
    const events: any[] = [];

    // 1) AI-jobs (анализы)
    const jobs = await getAll<any>(
      `SELECT id, job_type, status, error, started_at, finished_at, created_at
       FROM ai_jobs WHERE target_id = ? AND job_type IN ('analyze_track','reanalyze')
       ORDER BY created_at ASC`,
      [trackId]
    );
    for (const j of jobs) {
      events.push({
        kind: 'ai_job',
        at: j.finished_at || j.started_at || j.created_at,
        status: j.status,
        error: j.error,
        job_type: j.job_type,
      });
    }

    // 2) Текущая запись очереди модерации (AI-вердикт + ручное решение)
    const mq = await getOne<any>(
      `SELECT mq.*, u.username as reviewer_name
       FROM moderation_queue mq
       LEFT JOIN users u ON u.id = mq.reviewed_by
       WHERE mq.content_type='track' AND mq.content_id=?`,
      [trackId]
    );
    if (mq) {
      let aiFlags: any[] = [];
      try { aiFlags = mq.ai_flags ? JSON.parse(mq.ai_flags) : []; } catch { /* */ }
      events.push({
        kind: 'ai_decision',
        at: mq.created_at,
        ai_score: mq.ai_score,
        ai_flags: aiFlags,
        priority: mq.priority,
        status: mq.status,
      });
      if (mq.reviewed_at) {
        events.push({
          kind: 'moderator_decision',
          at: mq.reviewed_at,
          reviewer_id: mq.reviewed_by,
          reviewer_name: mq.reviewer_name,
          status: mq.status,
          comment: mq.review_comment,
        });
      }
    }

    // 3) Сам трек (создание + текущее состояние)
    const t = await getOne<any>(
      `SELECT id, status, created_at, updated_at FROM tracks WHERE id=?`,
      [trackId]
    );
    if (t) {
      events.unshift({ kind: 'uploaded', at: t.created_at });
      events.push({ kind: 'current_state', at: t.updated_at, status: t.status });
    }

    events.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
    res.json({ track_id: trackId, events });
  } catch (error) {
    console.error('Moderation history error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/tracks/:id/approve', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const trackId = parseInt(req.params.id as string);
    const reviewerId = req.user!.id;
    const comment: string | null = (req.body && typeof req.body.comment === 'string') ? req.body.comment.trim() : null;

    await runQuery('UPDATE tracks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['approved', trackId]);

    // Обновляем moderation_queue с решением модератора (если запись отсутствует — создаём аудит).
    const existingMq = await getOne<any>(
      `SELECT id FROM moderation_queue WHERE content_type='track' AND content_id=?`,
      [trackId]
    );
    if (existingMq) {
      await runQuery(
        `UPDATE moderation_queue
         SET status='approved', reviewed_by=?, review_comment=?, reviewed_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [reviewerId, comment, existingMq.id]
      );
    } else {
      const t = await getOne<any>('SELECT artist_id FROM tracks WHERE id=?', [trackId]);
      await runQuery(
        `INSERT INTO moderation_queue (content_type, content_id, submitted_by, status, priority, reviewed_by, review_comment, reviewed_at)
         VALUES ('track', ?, ?, 'approved', 'low', ?, ?, CURRENT_TIMESTAMP)`,
        [trackId, t?.artist_id, reviewerId, comment]
      );
    }

    const track = await getOne<any>('SELECT artist_id, title, album_id FROM tracks WHERE id = ?', [trackId]);
    if (track?.album_id) {
      const pendingInAlbum = await getOne<any>(
        'SELECT COUNT(*) as count FROM tracks WHERE album_id = ? AND status = ?',
        [track.album_id, 'pending']
      );
      if (!pendingInAlbum?.count || pendingInAlbum.count === 0) {
        await runQuery('UPDATE albums SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['approved', track.album_id]);
      }
    }

    // Уведомляем артиста.
    if (track) {
      try {
        await createNotification(
          track.artist_id,
          'track_moderated',
          reviewerId,
          'track',
          trackId,
          `Ваш трек «${track.title}» одобрен и опубликован.`
        );
      } catch (e) {
        console.warn('Failed to create approve notification:', e);
      }
    }

    res.json({ message: 'Трек одобрен' });
  } catch (error) {
    console.error('Approve track error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/tracks/:id/reject', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const trackId = parseInt(req.params.id as string);
    const reviewerId = req.user!.id;
    const rawComment = (req.body && typeof req.body.comment === 'string') ? req.body.comment.trim() : '';
    const comment = rawComment || null;

    await runQuery('UPDATE tracks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['rejected', trackId]);

    const existingMq = await getOne<any>(
      `SELECT id FROM moderation_queue WHERE content_type='track' AND content_id=?`,
      [trackId]
    );
    if (existingMq) {
      await runQuery(
        `UPDATE moderation_queue
         SET status='rejected', reviewed_by=?, review_comment=?, reviewed_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [reviewerId, comment, existingMq.id]
      );
    } else {
      const t = await getOne<any>('SELECT artist_id FROM tracks WHERE id=?', [trackId]);
      await runQuery(
        `INSERT INTO moderation_queue (content_type, content_id, submitted_by, status, priority, reviewed_by, review_comment, reviewed_at)
         VALUES ('track', ?, ?, 'rejected', 'normal', ?, ?, CURRENT_TIMESTAMP)`,
        [trackId, t?.artist_id, reviewerId, comment]
      );
    }

    const track = await getOne<any>('SELECT artist_id, title FROM tracks WHERE id = ?', [trackId]);
    if (track) {
      try {
        const tail = comment ? ` Причина: ${comment}` : '';
        await createNotification(
          track.artist_id,
          'track_moderated',
          reviewerId,
          'track',
          trackId,
          `Ваш трек «${track.title}» отклонён модератором.${tail}`
        );
      } catch (e) {
        console.warn('Failed to create reject notification:', e);
      }
    }

    res.json({ message: 'Трек отклонен' });
  } catch (error) {
    console.error('Reject track error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/albums/pending', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const albums = await getAll<any>(`
      SELECT a.*, u.username as artist_name,
        (SELECT COUNT(*) FROM tracks WHERE album_id = a.id) as track_count,
        (SELECT COUNT(*) FROM tracks WHERE album_id = a.id AND status = 'pending') as pending_count,
        (SELECT COUNT(*) FROM tracks WHERE album_id = a.id AND status = 'approved') as approved_count
       FROM albums a
       JOIN users u ON a.artist_id = u.id
       WHERE a.status = 'pending'
       ORDER BY a.created_at DESC
       LIMIT 50`
    );

    res.json(albums);
  } catch (error) {
    console.error('Moderation albums error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/albums/:id/tracks', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const albumId = parseInt(req.params.id as string);
    const tracks = await getAll<any>(`
      SELECT t.*, u.username as artist_name
       FROM tracks t
       JOIN users u ON t.artist_id = u.id
       WHERE t.album_id = ?
       ORDER COALESCE(t.track_number, 999), t.title`,
      [albumId]
    );

    res.json(tracks);
  } catch (error) {
    console.error('Get album tracks error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/albums/:id/approve', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const albumId = parseInt(req.params.id as string);
    
    await runQuery('UPDATE tracks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE album_id = ?', ['approved', albumId]);
    await runQuery('UPDATE albums SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['approved', albumId]);

    res.json({ message: 'Альбом одобрен' });
  } catch (error) {
    console.error('Approve album error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/albums/:id/reject', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const albumId = parseInt(req.params.id as string);

    const album = await getOne<any>('SELECT id, artist_id, title, cover_url FROM albums WHERE id = ?', [albumId]);
    if (!album) {
      return res.status(404).json({ error: 'Альбом не найден' });
    }

    const tracks = await getAll<any>('SELECT file_path, cover_url FROM tracks WHERE album_id = ?', [albumId]);
    
    for (const track of tracks) {
      if (track.file_path && !track.file_path.startsWith('http')) {
        const filePath = path.resolve(process.cwd(), '../', track.file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      if (track.cover_url && !track.cover_url.startsWith('http') && !track.cover_url.startsWith('/uploads/')) {
        const coverPath = path.resolve(process.cwd(), '../', track.cover_url);
        if (fs.existsSync(coverPath)) {
          fs.unlinkSync(coverPath);
        }
      }
    }

    await runQuery('DELETE FROM tracks WHERE album_id = ?', [albumId]);

    if (album.cover_url && !album.cover_url.startsWith('http') && !album.cover_url.startsWith('/uploads/')) {
      const coverPath = path.resolve(process.cwd(), '../', album.cover_url);
      if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath);
      }
    }

    await runQuery('DELETE FROM albums WHERE id = ?', [albumId]);

    res.json({ message: 'Альбом отклонен и удален' });
  } catch (error) {
    console.error('Reject album error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/stats', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const totalTracks = await getOne<any>('SELECT COUNT(*) as count FROM tracks');
    const totalAlbums = await getOne<any>('SELECT COUNT(*) as count FROM albums');
    const totalArtists = await getOne<any>("SELECT COUNT(*) as count FROM users WHERE role = 'artist'");
    const totalUsers = await getOne<any>('SELECT COUNT(*) as count FROM users');
    const pendingTracks = await getOne<any>("SELECT COUNT(*) as count FROM tracks WHERE status = 'pending'");
    const approvedTracks = await getOne<any>("SELECT COUNT(*) as count FROM tracks WHERE status = 'approved'");
    const rejectedTracks = await getOne<any>("SELECT COUNT(*) as count FROM tracks WHERE status = 'rejected'");
    const subscriptionRevenue = await getOne<any>(
      `SELECT SUM(amount) as total
       FROM transactions
       WHERE type = 'subscription' AND status = 'completed'`,
    );
    const ticketRevenueGross = await getOne<any>(
      `SELECT SUM(amount) as total
       FROM transactions
       WHERE type = 'ticket' AND status = 'completed'`,
    );
    const artistTicketEarnings = await getOne<any>(
      `SELECT SUM(COALESCE(total_earnings, 0)) as total
       FROM artist_profiles`,
    );
    const platformCommission = Math.max(0, Number(ticketRevenueGross?.total || 0) - Number(artistTicketEarnings?.total || 0));
    const totalRevenue = Number(subscriptionRevenue?.total || 0) + Number(platformCommission || 0);

    res.json({
      totalTracks: totalTracks?.count || 0,
      totalAlbums: totalAlbums?.count || 0,
      totalArtists: totalArtists?.count || 0,
      totalUsers: totalUsers?.count || 0,
      pendingTracks: pendingTracks?.count || 0,
      approvedTracks: approvedTracks?.count || 0,
      rejectedTracks: rejectedTracks?.count || 0,
      subscriptionRevenue: Number(subscriptionRevenue?.total || 0),
      ticketRevenueGross: Number(ticketRevenueGross?.total || 0),
      artistTicketEarnings: Number(artistTicketEarnings?.total || 0),
      platformCommission: Number(platformCommission || 0),
      totalRevenue: Number(totalRevenue || 0),
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/charts', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const revenueByDay = await getAll<any>(`
      SELECT DATE(completed_at) as date, SUM(amount) as total
      FROM transactions
      WHERE status = 'completed'
        AND type IN ('subscription', 'ticket')
        AND completed_at >= ?
      GROUP BY DATE(completed_at)
      ORDER BY date
    `, [startDate.toISOString()]);

    const usersByDay = await getAll<any>(`
      SELECT DATE(created_at) as date, COUNT(*) as count 
      FROM users 
      WHERE created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [startDate.toISOString()]);

    const tracksByGenre = await getAll<any>(`
      SELECT genre, COUNT(*) as count 
      FROM tracks 
      WHERE genre IS NOT NULL AND genre != ''
      GROUP BY genre
      ORDER BY count DESC
      LIMIT 10
    `);

    const topTracks = await getAll<any>(`
      SELECT t.id, t.title, u.username as artist_name, COUNT(tp.id) as play_count
      FROM tracks t
      JOIN users u ON t.artist_id = u.id
      LEFT JOIN track_plays tp ON t.id = tp.track_id
      WHERE t.status = 'approved'
      GROUP BY t.id
      ORDER BY play_count DESC
      LIMIT 10
    `);

    const topArtists = await getAll<any>(`
      SELECT u.id, u.username, COUNT(t.id) as track_count, COUNT(DISTINCT tp.track_id) as total_plays
      FROM users u
      LEFT JOIN tracks t ON u.id = t.artist_id AND t.status = 'approved'
      LEFT JOIN track_plays tp ON t.id = tp.track_id
      WHERE u.role = 'artist'
      GROUP BY u.id
      ORDER BY total_plays DESC
      LIMIT 10
    `);

    const playsByHour = await getAll<any>(`
      SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
      FROM track_plays
      GROUP BY hour
      ORDER BY hour
    `);

    res.json({
      revenueByDay,
      usersByDay,
      tracksByGenre,
      topTracks,
      topArtists,
      playsByHour,
    });
  } catch (error) {
    console.error('Admin charts error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/concerts/pending', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const concerts = await getAll<any>(`
      SELECT c.*, u.username as artist_name, u.avatar_url as artist_avatar
       FROM concerts c
       JOIN users u ON c.artist_id = u.id
       WHERE c.status = 'pending'
       ORDER BY c.created_at DESC
       LIMIT 100`
    );

    const ticketTypes = await getAll<any>(`SELECT id, concert_id, name, price, quantity, sold, description FROM ticket_types WHERE concert_id IN (${concerts.map(() => '?').join(',') || 'NULL'})`,
      concerts.map(c => c.id));

    const result = concerts.map(c => ({
      ...c,
      cover_url: c.cover_url
        ? (c.cover_url.startsWith('http') || c.cover_url.startsWith('/uploads/')
            ? c.cover_url
            : `/uploads/concerts/${c.cover_url}`)
        : null,
      ticket_types: ticketTypes.filter((tt: any) => tt.concert_id === c.id)
    }));

    res.json(result);
  } catch (error) {
    console.error('Moderation concerts error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/concerts/:id/approve', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const concertId = parseInt(req.params.id as string);
    await runQuery("UPDATE concerts SET status = 'available' WHERE id = ?", [concertId]);
    res.json({ message: 'Концерт одобрен' });
  } catch (error) {
    console.error('Approve concert error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/concerts/:id/reject', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const concertId = parseInt(req.params.id as string);
    const concert = await getOne<any>('SELECT cover_url FROM concerts WHERE id = ?', [concertId]);
    if (!concert) return res.status(404).json({ error: 'Концерт не найден' });

    if (concert.cover_url && !concert.cover_url.startsWith('http')) {
      const rel = concert.cover_url.startsWith('/uploads/')
        ? concert.cover_url.slice(1)
        : `uploads/concerts/${concert.cover_url}`;
      const coverPath = path.resolve(process.cwd(), rel);
      if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
    }

    await runQuery("UPDATE concerts SET status = 'rejected' WHERE id = ?", [concertId]);
    res.json({ message: 'Концерт отклонён' });
  } catch (error) {
    console.error('Reject concert error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/videos/pending', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const videos = await getAll<any>(`
      SELECT v.*, u.username as artist_name,
        t.title as track_title,
        a.title as album_title
      FROM videos v
      JOIN users u ON v.artist_id = u.id
      LEFT JOIN tracks t ON v.track_id = t.id
      LEFT JOIN albums a ON v.album_id = a.id
      WHERE v.status = 'pending'
      ORDER BY v.created_at DESC
      LIMIT 50`
    );

    const parsedVideos = videos.map((video: any) => {
      let thumbnailUrl = video.thumbnail_url;
      if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
        thumbnailUrl = `/uploads/thumbnails/${thumbnailUrl}`;
      }
      let filePath = video.file_path;
      if (filePath && !filePath.startsWith('http')) {
        filePath = `/uploads/videos/${filePath}`;
      }
      return {
        ...video,
        thumbnail_url: thumbnailUrl,
        file_path: filePath,
      };
    });

    res.json(parsedVideos);
  } catch (error) {
    console.error('Moderation videos error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/videos/:id/approve', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const videoId = parseInt(req.params.id as string);
    await runQuery('UPDATE videos SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['approved', videoId]);

    res.json({ message: 'Видео одобрено' });
  } catch (error) {
    console.error('Approve video error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/videos/:id/reject', authenticateToken, authorizeRole(['admin', 'moderator']), async (req: AuthRequest, res: Response) => {
  try {
    const videoId = parseInt(req.params.id as string);

    const video = await getOne<any>('SELECT id, artist_id, title, file_path, thumbnail_url FROM videos WHERE id = ?', [videoId]);
    if (!video) {
      return res.status(404).json({ error: 'Видео не найдено' });
    }

    if (video.file_path) {
      const filePath = path.resolve(process.cwd(), '..', video.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    if (video.thumbnail_url && !video.thumbnail_url.startsWith('http')) {
      const thumbPath = path.resolve(process.cwd(), '..', video.thumbnail_url);
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
      }
    }

    await runQuery('DELETE FROM videos WHERE id = ?', [videoId]);

    res.json({ message: 'Видео отклонено и удалено' });
  } catch (error) {
    console.error('Reject video error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
