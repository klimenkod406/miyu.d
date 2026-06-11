
import { Router, Response, Request } from 'express';
import { runQuery, getOne, getAll } from '../db';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { checkAchievementsForUser } from './user-achievements';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const router = Router();

const uploadDir = path.resolve(process.cwd(), 'uploads/playlists');
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

const upload = multer({ storage });

router.get('/user/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string);
    console.log('=== Loading playlists for user:', userId, '===');

    const playlists = await getAll<any>(
      `SELECT p.id, p.title, p.description, p.cover_url, p.is_public, p.is_pinned, p.created_at,
              COUNT(pt.track_id) as track_count
       FROM playlists p
       LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
       LEFT JOIN personalized_home_playlists php ON php.playlist_id = p.id
       WHERE p.user_id = ?
         AND php.playlist_id IS NULL
       GROUP BY p.id
       ORDER BY p.is_pinned DESC, p.created_at DESC`,
      [userId]
    );
    console.log('Playlists found:', playlists.length);

    const normalizedPlaylists = playlists.map((playlist: any) => {
      let coverUrl = playlist.cover_url;
      if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/playlists/') && !coverUrl.startsWith('data:image/')) {
        coverUrl = `/uploads/playlists/${coverUrl}`;
      }
      return { ...playlist, cover_url: coverUrl };
    });

    res.json(normalizedPlaylists);
  } catch (error) {
    console.error('Get user playlists error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const playlists = await getAll<any>(
      `SELECT p.*, COUNT(pt.track_id) as track_count
       FROM playlists p
       LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
       WHERE p.user_id = ?
       GROUP BY p.id
       ORDER BY p.is_pinned DESC, p.created_at DESC`,
      [req.user!.id]
    );

    const normalizedPlaylists = playlists.map((playlist: any) => {
      let coverUrl = playlist.cover_url;
      if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/playlists/') && !coverUrl.startsWith('data:image/')) {
        coverUrl = `/uploads/playlists/${coverUrl}`;
      }
      return { ...playlist, cover_url: coverUrl };
    });

    res.json(normalizedPlaylists);
  } catch (error) {
    console.error('Get playlists error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, is_public } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Название обязательно' });
    }

    const result = await runQuery(
      'INSERT INTO playlists (user_id, title, description, is_public) VALUES (?, ?, ?, ?)',
      [req.user!.id, title, description || null, is_public ? 1 : 0]
    );

    const unlockedAchievements = await checkAchievementsForUser(req.user!.id);

    const playlist = await getOne<any>('SELECT * FROM playlists WHERE id = ?', [result.lastID]);
    res.status(201).json({ ...playlist, unlockedAchievements });
  } catch (error) {
    console.error('Create playlist error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = parseInt(req.params.id as string);
    const { title, description, cover_url, is_public, is_pinned } = req.body;
    
    const playlist = await getOne<any>('SELECT * FROM playlists WHERE id = ?', [playlistId]);
    if (!playlist) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }

    if (playlist.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    await runQuery(
      `UPDATE playlists SET title = COALESCE(?, title), description = COALESCE(?, description), cover_url = COALESCE(?, cover_url), is_public = COALESCE(?, is_public), is_pinned = COALESCE(?, is_pinned), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [title || null, description !== undefined ? description : null, cover_url !== undefined ? cover_url : null, is_public !== undefined ? (is_public ? 1 : 0) : null, is_pinned !== undefined ? (is_pinned ? 1 : 0) : null, playlistId]
    );

    const updated = await getOne<any>('SELECT * FROM playlists WHERE id = ?', [playlistId]);
    res.json(updated);
  } catch (error) {
    console.error('Update playlist error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/cover', authenticateToken, upload.single('cover'), async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = parseInt(req.params.id as string);
    
    const playlist = await getOne<any>('SELECT * FROM playlists WHERE id = ?', [playlistId]);
    if (!playlist) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }

    if (playlist.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const coverFile = req.file;
    if (!coverFile) {
      return res.status(400).json({ error: 'Файл обложки обязателен' });
    }

    const coverUrl = `/uploads/playlists/${coverFile.filename}`;
    await runQuery('UPDATE playlists SET cover_url = ? WHERE id = ?', [coverUrl, playlistId]);

    res.json({ cover_url: coverUrl });
  } catch (error) {
    console.error('Upload cover error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/liked/all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const playlists = await getAll<any>(
      `SELECT p.id, p.title, p.description, p.cover_url, p.is_public, p.is_system, p.is_pinned,
              p.user_id, p.created_at, p.updated_at, u.username as owner_name,
              COUNT(DISTINCT pt.track_id) as track_count,
              MAX(pl.created_at) as liked_at
       FROM playlist_likes pl
       JOIN playlists p ON p.id = pl.playlist_id
       JOIN users u ON u.id = p.user_id
       LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
       LEFT JOIN personalized_home_playlists php ON php.playlist_id = p.id
       WHERE pl.user_id = ? AND php.playlist_id IS NULL
       GROUP BY p.id
       ORDER BY liked_at DESC`,
      [req.user!.id]
    );

    const normalized = playlists.map((playlist: any) => {
      let coverUrl = playlist.cover_url;
      if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/playlists/') && !coverUrl.startsWith('data:image/')) {
        coverUrl = `/uploads/playlists/${coverUrl}`;
      }
      return { ...playlist, cover_url: coverUrl, is_liked: true, can_be_liked: true };
    });

    res.json(normalized);
  } catch (error) {
    console.error('Get liked playlists error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/like', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = parseInt(req.params.id as string);

    const playlist = await getOne<any>('SELECT * FROM playlists WHERE id = ?', [playlistId]);
    if (!playlist) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }

    const isPersonalizedDaily = await getOne<any>(
      `SELECT 1 as exists_flag
       FROM personalized_home_playlists
       WHERE playlist_id = ? AND kind = 'daily'`,
      [playlistId]
    );

    if (isPersonalizedDaily) {
      return res.status(400).json({ error: 'Этот персональный плейлист нельзя сохранить' });
    }

    if (playlist.user_id === req.user!.id) {
      return res.status(400).json({ error: 'Нельзя сохранять собственный плейлист' });
    }

    const existing = await getOne<any>(
      'SELECT id FROM playlist_likes WHERE user_id = ? AND playlist_id = ?',
      [req.user!.id, playlistId]
    );

    if (existing) {
      await runQuery('DELETE FROM playlist_likes WHERE id = ?', [existing.id]);
      return res.json({ liked: false });
    }

    await runQuery(
      'INSERT INTO playlist_likes (user_id, playlist_id) VALUES (?, ?)',
      [req.user!.id, playlistId]
    );

    res.json({ liked: true });
  } catch (error) {
    console.error('Toggle playlist like error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = parseInt(req.params.id as string);
    
    const playlist = await getOne<any>(
      `SELECT p.*, u.username as owner_name 
       FROM playlists p 
       JOIN users u ON p.user_id = u.id 
       WHERE p.id = ?`,
      [playlistId]
    );

    if (!playlist) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }

    const personalizedPlaylist = await getOne<any>(
      `SELECT user_id, kind
       FROM personalized_home_playlists
       WHERE playlist_id = ?`,
      [playlistId]
    );

    if (personalizedPlaylist && playlist.user_id !== req.user!.id) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }

    const likedRecord = await getOne<any>(
      'SELECT id FROM playlist_likes WHERE user_id = ? AND playlist_id = ?',
      [req.user!.id, playlistId]
    );

    const tracks = await getAll<any>(
      `SELECT t.*, plt.added_at,
              u.username as artist_name, u.id as artist_id
       FROM playlist_tracks plt
       JOIN tracks t ON plt.track_id = t.id
       JOIN users u ON t.artist_id = u.id
       WHERE plt.playlist_id = ?
       ORDER BY plt.added_at DESC`,
      [playlistId]
    );

    const parsedTracks = tracks.map((track: any) => {
      let coverUrl = track.cover_url;
      if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
        coverUrl = `/uploads/tracks/${coverUrl}`;
      }
      return { ...track, cover_url: coverUrl };
    });

    res.json({
      ...playlist,
      tracks: parsedTracks,
      is_liked: !!likedRecord,
      can_be_liked: !personalizedPlaylist && playlist.user_id !== req.user!.id,
    });
  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = parseInt(req.params.id as string);
    
    const playlist = await getOne<any>('SELECT * FROM playlists WHERE id = ?', [playlistId]);
    if (!playlist) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }

    if (playlist.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    if (playlist.is_system) {
      return res.status(400).json({ error: 'Системный плейлист нельзя удалить вручную' });
    }

    await runQuery('DELETE FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
    await runQuery('DELETE FROM playlists WHERE id = ?', [playlistId]);

    res.json({ message: 'Плейлист удален' });
  } catch (error) {
    console.error('Delete playlist error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/tracks/:trackId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = parseInt(req.params.id as string);
    const trackId = parseInt(req.params.trackId as string);
    
    const playlist = await getOne<any>('SELECT * FROM playlists WHERE id = ?', [playlistId]);
    if (!playlist) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }

    if (playlist.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    if (playlist.is_system) {
      return res.status(400).json({ error: 'В системные плейлисты нельзя добавлять треки вручную' });
    }

    const existing = await getOne<any>(
      'SELECT id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
      [playlistId, trackId]
    );

    if (existing) {
      return res.status(400).json({ error: 'Трек уже в плейлисте' });
    }

    const maxPos = await getOne<any>('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
    const nextPosition = (maxPos?.maxPos || 0) + 1;

    await runQuery(
      'INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)',
      [playlistId, trackId, nextPosition]
    );

    res.json({ message: 'Трек добавлен' });
  } catch (error) {
    console.error('Add track to playlist error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id/tracks/:trackId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = parseInt(req.params.id as string);
    const trackId = parseInt(req.params.trackId as string);
    
    const playlist = await getOne<any>('SELECT * FROM playlists WHERE id = ?', [playlistId]);
    if (!playlist) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }

    if (playlist.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    if (playlist.is_system) {
      return res.status(400).json({ error: 'Из системных плейлистов нельзя удалять треки вручную' });
    }

    await runQuery(
      'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
      [playlistId, trackId]
    );

    res.json({ message: 'Трек удален' });
  } catch (error) {
    console.error('Remove track from playlist error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id/has-track/:trackId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = parseInt(req.params.id as string);
    const trackId = parseInt(req.params.trackId as string);

    const playlist = await getOne<any>('SELECT * FROM playlists WHERE id = ?', [playlistId]);
    if (!playlist) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }

    const existing = await getOne<any>(
      'SELECT id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
      [playlistId, trackId]
    );

    res.json({ exists: !!existing });
  } catch (error) {
    console.error('Check track in playlist error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
