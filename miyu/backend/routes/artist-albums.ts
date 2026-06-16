
import { Router, Response, Request } from 'express';
import { db, runQuery, getOne, getAll } from '../db';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const router = Router();

const uploadDir = path.resolve(__dirname, '..', '..', 'uploads/albums');
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

interface UploadRequest extends AuthRequest {
  file?: any;
}

router.get('/albums', authenticateToken, authorizeRole(['artist', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const albums = await getAll<any>(
      `SELECT a.*, 
        (SELECT COUNT(*) FROM tracks WHERE album_id = a.id) as track_count,
        (SELECT SUM(duration) FROM tracks WHERE album_id = a.id) as total_duration
       FROM albums a
       WHERE a.artist_id = ?
       ORDER BY a.created_at DESC`,
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
    console.error('Artist albums error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/albums', authenticateToken, authorizeRole(['artist', 'admin']), upload.single('cover'), async (req: UploadRequest, res: Response) => {
  try {
    const { title, genre, type, description } = req.body;
    const coverFile = req.file;

    if (!title) {
      return res.status(400).json({ error: 'Название альбома обязательно' });
    }

    const release_year = new Date().getFullYear();
    const coverUrl = coverFile ? `/uploads/albums/${coverFile.filename}` : null;

    const result = await runQuery(
      `INSERT INTO albums (artist_id, title, release_year, genre, type, description, cover_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        req.user!.id,
        title,
        release_year,
        genre || null,
        type || 'album',
        description || null,
        coverUrl
      ]
    );

    const album = await getOne<any>('SELECT id, artist_id, title, release_year, cover_url, description, genre, type, status, created_at FROM albums WHERE id = ?', [result.lastID]);
    res.status(201).json(album);
  } catch (error) {
    console.error("--- ALBUM CREATION FAILED ---");
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/albums/:id', authenticateToken, authorizeRole(['artist', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const albumId = parseInt(req.params.id as string);
    const { title, release_year, genre, type, description, cover_url } = req.body;

    const album = await getOne<any>('SELECT id, artist_id, title, release_year, cover_url, description, genre, type, status, created_at FROM albums WHERE id = ?', [albumId]);
    if (!album) {
      return res.status(404).json({ error: 'Альбом не найден' });
    }

    if (album.artist_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    await runQuery(
      `UPDATE albums SET title = ?, release_year = ?, genre = ?, type = ?, description = ?, cover_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title || album.title,
        release_year ?? album.release_year,
        genre ?? album.genre,
        type || album.type,
        description ?? album.description,
        cover_url ?? album.cover_url,
        albumId
      ]
    );

    const updatedAlbum = await getOne<any>('SELECT id, artist_id, title, release_year, cover_url, description, genre, type, status, created_at FROM albums WHERE id = ?', [albumId]);
    res.json(updatedAlbum);
  } catch (error) {
    console.error('Update album error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/albums/:id', authenticateToken, authorizeRole(['artist', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const albumId = parseInt(req.params.id as string);

    const album = await getOne<any>('SELECT id, artist_id, title, release_year, cover_url, description, genre, type, status, created_at FROM albums WHERE id = ?', [albumId]);
    if (!album) {
      return res.status(404).json({ error: 'Альбом не найден' });
    }

    if (album.artist_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const tracks = await getAll<any>('SELECT file_path, cover_url FROM tracks WHERE album_id = ?', [albumId]);
    
    for (const track of tracks) {
      if (track.file_path) {
        const filePath = path.resolve(process.cwd(), '../', track.file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      if (track.cover_url && !track.cover_url.startsWith('http')) {
        const coverPath = path.resolve(process.cwd(), '../', track.cover_url);
        if (fs.existsSync(coverPath)) {
          fs.unlinkSync(coverPath);
        }
      }
    }

    await runQuery('DELETE FROM tracks WHERE album_id = ?', [albumId]);
    
    if (album.cover_url && !album.cover_url.startsWith('http')) {
      const coverPath = path.resolve(process.cwd(), '../', album.cover_url);
      if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath);
      }
    }

    await runQuery('DELETE FROM albums WHERE id = ?', [albumId]);
    res.json({ message: 'Альбом удален' });
  } catch (error) {
    console.error('Delete album error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
