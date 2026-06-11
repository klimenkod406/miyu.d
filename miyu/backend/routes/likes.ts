
import { Router, Response } from 'express';
import { runQuery, getOne, getAll } from '../db';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { checkAchievementsForUser } from './user-achievements';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const likes = await getAll<any>(
      `SELECT l.*, t.title, t.duration, t.cover_url, t.file_path, 
              u.username as artist_name, u.id as artist_id
       FROM likes l
       JOIN tracks t ON l.track_id = t.id
       JOIN users u ON t.artist_id = u.id
       WHERE l.user_id = ?
       ORDER BY l.created_at DESC`,
      [req.user!.id]
    );

    const parsedLikes = likes.map((like: any) => {
      let coverUrl = like.cover_url;
      if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
        coverUrl = `/uploads/tracks/${coverUrl}`;
      }
      return {
        ...like,
        cover_url: coverUrl,
      };
    });

    res.json(parsedLikes);
  } catch (error) {
    console.error('Get likes error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/albums', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const albumLikes = await getAll<any>(
      `SELECT al.*, a.title, a.cover_url, a.release_year, a.type,
              u.username as artist_name, u.id as artist_id,
              (SELECT COUNT(*) FROM tracks t WHERE t.album_id = a.id) as track_count
       FROM album_likes al
       JOIN albums a ON al.album_id = a.id
       JOIN users u ON a.artist_id = u.id
       WHERE al.user_id = ?
       ORDER BY al.created_at DESC`,
      [req.user!.id]
    );

    const parsedAlbumLikes = albumLikes.map((like: any) => {
      let coverUrl = like.cover_url;
      if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
        coverUrl = `/uploads/albums/${coverUrl}`;
      }
      return {
        ...like,
        cover_url: coverUrl,
      };
    });

    res.json(parsedAlbumLikes);
  } catch (error) {
    console.error('Get album likes error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/albums/:albumId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const albumId = parseInt(req.params.albumId as string);

    const existing = await getOne<any>(
      'SELECT id FROM album_likes WHERE user_id = ? AND album_id = ?',
      [req.user!.id, albumId]
    );

    if (existing) {
      await runQuery('DELETE FROM album_likes WHERE user_id = ? AND album_id = ?', [req.user!.id, albumId]);
      return res.json({ liked: false });
    }

    await runQuery(
      'INSERT INTO album_likes (user_id, album_id) VALUES (?, ?)',
      [req.user!.id, albumId]
    );

    const unlockedAchievements = await checkAchievementsForUser(req.user!.id);

    res.json({ liked: true, unlockedAchievements });
  } catch (error) {
    console.error('Toggle album like error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/albums/check/:albumId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const albumId = parseInt(req.params.albumId as string);
    const like = await getOne<any>(
      'SELECT id FROM album_likes WHERE user_id = ? AND album_id = ?',
      [req.user!.id, albumId]
    );
    res.json({ liked: !!like });
  } catch (error) {
    console.error('Check album like error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:trackId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const trackId = parseInt(req.params.trackId as string);

    const existing = await getOne<any>(
      'SELECT id FROM likes WHERE user_id = ? AND track_id = ?',
      [req.user!.id, trackId]
    );

    if (existing) {
      await runQuery('DELETE FROM likes WHERE user_id = ? AND track_id = ?', [req.user!.id, trackId]);
      return res.json({ liked: false });
    }

    await runQuery(
      'INSERT INTO likes (user_id, track_id) VALUES (?, ?)',
      [req.user!.id, trackId]
    );

    const unlockedAchievements = await checkAchievementsForUser(req.user!.id);

    res.json({ liked: true, unlockedAchievements });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/check/:trackId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const trackId = parseInt(req.params.trackId as string);
    const like = await getOne<any>(
      'SELECT id FROM likes WHERE user_id = ? AND track_id = ?',
      [req.user!.id, trackId]
    );
    res.json({ liked: !!like });
  } catch (error) {
    console.error('Check like error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;

router.get('/user/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string);
    const requestingUserId = req.user?.id;

    // Check if requesting user is viewing their own profile
    const isOwnProfile = requestingUserId === userId;

    // If not own profile, check privacy settings
    if (!isOwnProfile) {
      const userSettings = await getOne<any>(
        'SELECT show_favorite_tracks FROM users WHERE id = ?',
        [userId]
      );

      if (userSettings && !userSettings.show_favorite_tracks) {
        return res.json([]);
      }
    }

    const likes = await getAll<any>(
      `SELECT l.track_id as id, t.title, t.duration, t.cover_url, t.file_path,
              u.username as artist_name, u.id as artist_id,
              json_object('id', u.id, 'username', u.username) as artist
       FROM likes l
       JOIN tracks t ON l.track_id = t.id
       JOIN users u ON t.artist_id = u.id
       WHERE l.user_id = ?
       ORDER BY l.created_at DESC`,
      [userId]
    );

    const parsedLikes = likes.map((like: any) => {
      let coverUrl = like.cover_url;
      if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
        coverUrl = `/uploads/tracks/${coverUrl}`;
      }
      return {
        ...like,
        cover_url: coverUrl,
        artist: typeof like.artist === 'string' ? JSON.parse(like.artist) : like.artist
      };
    });

    res.json(parsedLikes);
  } catch (error) {
    console.error('Get user likes error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/albums/user/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string);
    const requestingUserId = req.user?.id;

    // Check if requesting user is viewing their own profile
    const isOwnProfile = requestingUserId === userId;

    // If not own profile, check privacy settings
    if (!isOwnProfile) {
      const userSettings = await getOne<any>(
        'SELECT show_favorite_albums FROM users WHERE id = ?',
        [userId]
      );

      if (userSettings && !userSettings.show_favorite_albums) {
        return res.json([]);
      }
    }

    const albumLikes = await getAll<any>(
      `SELECT al.album_id as id, a.title, a.cover_url, a.release_year,
              u.username as artist_name, u.id as artist_id,
              json_object('id', u.id, 'username', u.username) as artist
       FROM album_likes al
       JOIN albums a ON al.album_id = a.id
       JOIN users u ON a.artist_id = u.id
       WHERE al.user_id = ?
       ORDER BY al.created_at DESC`,
      [userId]
    );

    const parsedAlbumLikes = albumLikes.map((like: any) => {
      let coverUrl = like.cover_url;
      if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
        coverUrl = `/uploads/albums/${coverUrl}`;
      }
      return {
        ...like,
        cover_url: coverUrl,
        artist: typeof like.artist === 'string' ? JSON.parse(like.artist) : like.artist
      };
    });

    res.json(parsedAlbumLikes);
  } catch (error) {
    console.error('Get user album likes error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
