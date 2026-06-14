
import { Router, Response, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { runQuery, getOne, getAll } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const videoUploadDir = path.resolve(process.cwd(), '..', 'uploads/videos');
if (!fs.existsSync(videoUploadDir)) {
  fs.mkdirSync(videoUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: Request, _file: any, cb: (error: Error | null, destination: string) => void) => cb(null, videoUploadDir),
  filename: (_req: Request, file: any, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

interface Video {
  id: number;
  artist_id: number;
  album_id: number | null;
  track_id: number | null;
  title: string;
  description: string | null;
  duration: number;
  file_path: string;
  thumbnail_url: string | null;
  status: string;
  views_count: number;
  created_at: string;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const videos = await getAll<any>(`
      SELECT v.*, u.username as artist_name, u.id as artist_id,
        t.title as track_title,
        a.title as album_title
      FROM videos v
      JOIN users u ON v.artist_id = u.id
      LEFT JOIN tracks t ON v.track_id = t.id
      LEFT JOIN albums a ON v.album_id = a.id
      WHERE v.status = 'approved'
      ORDER BY v.created_at DESC
      LIMIT 50
    `);

    const parsedVideos = videos.map((video: any) => {
      let thumbnailUrl = video.thumbnail_url;
      if (thumbnailUrl && !thumbnailUrl.startsWith('http') && !thumbnailUrl.startsWith('/uploads/')) {
        thumbnailUrl = `/uploads/thumbnails/${thumbnailUrl}`;
      }
      return {
        ...video,
        thumbnail_url: thumbnailUrl,
      };
    });

    res.json(parsedVideos);
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/popular', async (_req: Request, res: Response) => {
  try {
    const videos = await getAll<any>(`
      SELECT v.*, u.username as artist_name, u.id as artist_id,
        t.title as track_title,
        a.title as album_title
      FROM videos v
      JOIN users u ON v.artist_id = u.id
      LEFT JOIN tracks t ON v.track_id = t.id
      LEFT JOIN albums a ON v.album_id = a.id
      WHERE v.status = 'approved'
      ORDER BY v.views_count DESC
      LIMIT 50
    `);

    const parsedVideos = videos.map((video: any) => {
      let thumbnailUrl = video.thumbnail_url;
      if (thumbnailUrl && !thumbnailUrl.startsWith('http') && !thumbnailUrl.startsWith('/uploads/')) {
        thumbnailUrl = `/uploads/thumbnails/${thumbnailUrl}`;
      }
      let filePath = video.file_path;
      if (filePath && !filePath.startsWith('http') && !filePath.startsWith('/uploads/')) {
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
    console.error('Get popular videos error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/history/views', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const views = await getAll<any>(
      `SELECT vv.id, vv.video_id, vv.view_duration, vv.completed, vv.created_at,
        v.title, v.thumbnail_url, v.file_path, v.duration, v.views_count,
        v.artist_id, v.track_id,
        u.username as artist_name,
        t.title as track_title
      FROM video_views vv
      JOIN videos v ON vv.video_id = v.id
      JOIN users u ON v.artist_id = u.id
      LEFT JOIN tracks t ON v.track_id = t.id
      WHERE vv.user_id = ?
      ORDER BY vv.created_at DESC
      LIMIT 100`,
      [userId]
    );

    const parsedViews = views.map((v: any) => {
      let thumbnailUrl = v.thumbnail_url;
      if (thumbnailUrl && !thumbnailUrl.startsWith('http') && !thumbnailUrl.startsWith('/uploads/')) {
        thumbnailUrl = `/uploads/thumbnails/${thumbnailUrl}`;
      }
      return {
        id: v.id,
        video_id: v.video_id,
        view_duration: v.view_duration,
        completed: v.completed === 1,
        created_at: v.created_at,
        video: {
          id: v.video_id,
          title: v.title,
          thumbnail_url: thumbnailUrl,
          duration: v.duration,
          views_count: v.views_count,
          artist: { id: v.artist_id, username: v.artist_name },
          track: v.track_id ? { id: v.track_id, title: v.track_title } : null,
        }
      };
    });

    res.json(parsedViews);
  } catch (error) {
    console.error('Get video history error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const videoId = parseInt(req.params.id as string);

    const video = await getOne<any>(`
      SELECT v.*, u.username as artist_name, u.id as artist_id,
        t.title as track_title, t.duration as track_duration,
        a.title as album_title, a.cover_url as album_cover
      FROM videos v
      JOIN users u ON v.artist_id = u.id
      LEFT JOIN tracks t ON v.track_id = t.id
      LEFT JOIN albums a ON v.album_id = a.id
      WHERE v.id = ?`,
      [videoId]
    );

    if (!video) {
      return res.status(404).json({ error: 'Видео не найдено' });
    }

    let thumbnailUrl = video.thumbnail_url;
    if (thumbnailUrl && !thumbnailUrl.startsWith('http') && !thumbnailUrl.startsWith('/uploads/')) {
      thumbnailUrl = `/uploads/thumbnails/${thumbnailUrl}`;
    }
    let filePath = video.file_path;
    if (filePath && !filePath.startsWith('http') && !filePath.startsWith('/uploads/')) {
      filePath = `/uploads/videos/${filePath}`;
    }
    let albumCover = video.album_cover;
    if (albumCover && !albumCover.startsWith('http') && !albumCover.startsWith('/uploads/')) {
      albumCover = `/uploads/albums/${albumCover}`;
    }

    res.json({
      ...video,
      thumbnail_url: thumbnailUrl,
      file_path: filePath,
      album: video.album_id ? { id: video.album_id, title: video.album_title, cover_url: albumCover } : null,
    });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/artist/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId as string);

    const videos = await getAll<any>(`
      SELECT v.*, t.title as track_title
      FROM videos v
      LEFT JOIN tracks t ON v.track_id = t.id
      WHERE v.artist_id = ?
      ORDER BY v.created_at DESC`,
      [artistId]
    );

    const parsedVideos = videos.map((video: any) => {
      let thumbnailUrl = video.thumbnail_url;
      if (thumbnailUrl && !thumbnailUrl.startsWith('http') && !thumbnailUrl.startsWith('/uploads/')) {
        thumbnailUrl = `/uploads/thumbnails/${thumbnailUrl}`;
      }
      let filePath = video.file_path;
      if (filePath && !filePath.startsWith('http') && !filePath.startsWith('/uploads/')) {
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
    console.error('Get artist videos error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/view', async (req: Request, res: Response) => {
  try {
    const videoId = parseInt(req.params.id as string);
    if (Number.isNaN(videoId)) {
      return res.status(400).json({ error: 'Некорректный id видео' });
    }

    const video = await getOne<any>('SELECT id FROM videos WHERE id = ?', [videoId]);
    if (!video) {
      return res.status(404).json({ error: 'Видео не найдено' });
    }

    await runQuery('UPDATE videos SET views_count = views_count + 1 WHERE id = ?', [videoId]);

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const jwt = require('jsonwebtoken');
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'miyu-secret') as any;
        if (payload && payload.id) {
          const { duration, completed } = req.body || {};
          await runQuery(
            'INSERT INTO video_views (video_id, user_id, playlist_id, view_duration, completed) VALUES (?, ?, NULL, ?, ?)',
            [videoId, payload.id, typeof duration === 'number' ? Math.max(0, Math.floor(duration)) : 0, completed ? 1 : 0]
          );
        }
      } catch {
        // invalid/expired token — anonymous view already counted
      }
    }

    res.json({ message: 'View recorded' });
  } catch (error) {
    console.error('Record video view error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
