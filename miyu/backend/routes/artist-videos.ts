
import { Router, Response, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { runQuery, getOne, getAll } from '../db';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/auth';

const router = Router();

const videosDir = path.resolve(process.cwd(), 'uploads/videos');
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
}

const thumbnailsDir = path.resolve(process.cwd(), 'uploads/thumbnails');
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function(_req, file, cb) {
    const dest = file.fieldname === 'thumbnail' ? thumbnailsDir : videosDir;
    cb(null, dest);
  },
  filename: function(_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

interface UploadRequest extends AuthRequest {
  files?: any;
}

router.get('/videos', authenticateToken, authorizeRole(['artist', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const videos = await getAll<any>(`
      SELECT v.*, t.title as track_title, a.title as album_title
      FROM videos v
      LEFT JOIN tracks t ON v.track_id = t.id
      LEFT JOIN albums a ON v.album_id = a.id
      WHERE v.artist_id = ?
      ORDER BY v.created_at DESC`,
      [req.user!.id]
    );

    const parsedVideos = videos.map((video: any) => {
      let thumbnailUrl = video.thumbnail_url;
      if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
        thumbnailUrl = `/uploads/thumbnails/${thumbnailUrl}`;
      }
      return {
        ...video,
        thumbnail_url: thumbnailUrl,
      };
    });

    res.json(parsedVideos);
  } catch (error) {
    console.error('Artist videos error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/videos', 
  authenticateToken, authorizeRole(['artist', 'admin']),
  upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), 
  async (req: UploadRequest, res: Response) => {
    try {
      const { title, description, track_id, album_id, duration } = req.body;
      const videoFile = req.files?.['video']?.[0];
      const thumbnailFile = req.files?.['thumbnail']?.[0];

      if (!title || !duration || !videoFile) {
        return res.status(400).json({ error: 'Название, длительность и видеофайл обязательны' });
      }

      let thumbnailUrl: string | null = null;
      if (thumbnailFile) {
        thumbnailUrl = thumbnailFile.filename;
      }

      let trackId: number | undefined = undefined;
      if (track_id) {
        const track = await getOne<any>('SELECT id, status FROM tracks WHERE id = ?', [parseInt(track_id as string)]);
        if (!track) {
          return res.status(400).json({ error: 'Трек не найден' });
        }
        if (track.status !== 'approved') {
          return res.status(400).json({ error: 'Можно добавить клип только к одобренному треку' });
        }
        trackId = track.id;
      }

      let albumId: number | undefined = undefined;
      if (album_id) {
        const album = await getOne<any>('SELECT id, status FROM albums WHERE id = ?', [parseInt(album_id as string)]);
        if (!album) {
          return res.status(400).json({ error: 'Альбом не найден' });
        }
        if (album.status !== 'approved') {
          return res.status(400).json({ error: 'Можно добавить клип только к одобренному альбому' });
        }
        albumId = album.id;
      }

      const result = await runQuery(
        `INSERT INTO videos (artist_id, title, description, duration, file_path, thumbnail_url, track_id, album_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user!.id,
          title,
          description || null,
          parseInt(duration as string),
          videoFile.filename,
          thumbnailUrl,
          trackId,
          albumId
        ]
      );

      const video = await getOne<any>('SELECT * FROM videos WHERE id = ?', [result.lastID]);
      
      let thumbnailFinalUrl = video.thumbnail_url;
      if (thumbnailFinalUrl && !thumbnailFinalUrl.startsWith('/uploads/')) {
        thumbnailFinalUrl = `/uploads/thumbnails/${thumbnailFinalUrl}`;
      }

      res.status(201).json({
        ...video,
        thumbnail_url: thumbnailFinalUrl
      });
    } catch (error) {
      console.error('Create video error:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

router.patch('/videos/:id', authenticateToken, authorizeRole(['artist', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const videoId = parseInt(req.params.id as string);
    const { title, description, track_id, album_id } = req.body;

    const video = await getOne<any>('SELECT * FROM videos WHERE id = ?', [videoId]);
    if (!video) {
      return res.status(404).json({ error: 'Видео не найдено' });
    }

    if (video.artist_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    let trackId = video.track_id;
    if (track_id !== undefined) {
      if (track_id) {
        const track = await getOne<any>('SELECT status FROM tracks WHERE id = ?', [parseInt(track_id as string)]);
        if (track && track.status !== 'approved') {
          return res.status(400).json({ error: 'Можно добавить клип только к одобренному треку' });
        }
        trackId = track?.id || null;
      } else {
        trackId = null;
      }
    }

    let albumId = video.album_id;
    if (album_id !== undefined) {
      if (album_id) {
        const album = await getOne<any>('SELECT status FROM albums WHERE id = ?', [parseInt(album_id as string)]);
        if (album && album.status !== 'approved') {
          return res.status(400).json({ error: 'Можно добавить клип только к одобренному альбому' });
        }
        albumId = album?.id || null;
      } else {
        albumId = null;
      }
    }

    await runQuery(
      `UPDATE videos SET title = ?, description = ?, track_id = ?, album_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title || video.title,
        description ?? video.description,
        trackId,
        albumId,
        videoId
      ]
    );

    const updatedVideo = await getOne<any>('SELECT * FROM videos WHERE id = ?', [videoId]);
    res.json(updatedVideo);
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/videos/:id', authenticateToken, authorizeRole(['artist', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const videoId = parseInt(req.params.id as string);

    const video = await getOne<any>('SELECT * FROM videos WHERE id = ?', [videoId]);
    if (!video) {
      return res.status(404).json({ error: 'Видео не найдено' });
    }

    if (video.artist_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    if (video.file_path) {
      const filePath = path.resolve(process.cwd(), '..', 'uploads/videos', video.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    if (video.thumbnail_url && !video.thumbnail_url.startsWith('http')) {
      const thumbPath = path.resolve(process.cwd(), '..', 'uploads/thumbnails', video.thumbnail_url);
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
      }
    }

    await runQuery('DELETE FROM videos WHERE id = ?', [videoId]);
    res.json({ message: 'Видео удалено' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/approved-tracks', authenticateToken, authorizeRole(['artist', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const tracks = await getAll<any>(`
      SELECT t.id, t.title, t.duration, t.cover_url, a.title as album_title
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      WHERE t.artist_id = ? AND t.status = 'approved'
      ORDER BY t.title`,
      [req.user!.id]
    );

    const parsedTracks = tracks.map((track: any) => {
      let coverUrl = track.cover_url;
      if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
        coverUrl = `/uploads/tracks/${coverUrl}`;
      }
      return {
        ...track,
        cover_url: coverUrl,
      };
    });

    res.json(parsedTracks);
  } catch (error) {
    console.error('Approved tracks error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/approved-albums', authenticateToken, authorizeRole(['artist', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const albums = await getAll<any>(`
      SELECT a.id, a.title, a.cover_url
      FROM albums a
      WHERE a.artist_id = ? AND a.status = 'approved'
      ORDER BY a.title`,
      [req.user!.id]
    );

    const parsedAlbums = albums.map((album: any) => {
      if (album.cover_url && !album.cover_url.startsWith('http') && !album.cover_url.startsWith('/uploads/')) {
        album.cover_url = `/uploads/albums/${album.cover_url}`;
      }
      return album;
    });

    res.json(parsedAlbums);
  } catch (error) {
    console.error('Approved albums error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
