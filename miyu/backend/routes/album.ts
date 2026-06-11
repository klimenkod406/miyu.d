import { Router, Response, Request } from 'express';
import { getOne, getAll } from '../db';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const albums = await getAll<any>(`
      SELECT a.*, u.username as artist_name, u.id as artist_id,
        (SELECT COUNT(*) FROM tracks WHERE album_id = a.id) as track_count
      FROM albums a
      JOIN users u ON a.artist_id = u.id
      WHERE a.status = 'approved'
      ORDER BY a.created_at DESC
      LIMIT 50
    `);

    const parsedAlbums = albums.map((album: any) => {
      if (album.cover_url && !album.cover_url.startsWith('http') && !album.cover_url.startsWith('/uploads/')) {
        album.cover_url = `/uploads/albums/${album.cover_url}`;
      }
      return album;
    });

    res.json(parsedAlbums);
  } catch (error) {
    console.error('Get albums error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/popular', async (_req: Request, res: Response) => {
  try {
    const albums = await getAll<any>(`
      SELECT a.*, u.username as artist_name, u.id as artist_id,
        (SELECT COUNT(*) FROM tracks WHERE album_id = a.id) as track_count,
        COALESCE((SELECT SUM(tp.play_duration) FROM track_plays tp JOIN tracks t ON tp.track_id = t.id WHERE t.album_id = a.id), 0) as total_plays
      FROM albums a
      JOIN users u ON a.artist_id = u.id
      WHERE a.status = 'approved'
      ORDER BY total_plays DESC
      LIMIT 50
    `);

    const parsedAlbums = albums.map((album: any) => {
      if (album.cover_url && !album.cover_url.startsWith('http') && !album.cover_url.startsWith('/uploads/')) {
        album.cover_url = `/uploads/albums/${album.cover_url}`;
      }
      return album;
    });

    res.json(parsedAlbums);
  } catch (error) {
    console.error('Get popular albums error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const albumId = parseInt(req.params.id as string);

    const album = await getOne<any>(
      `SELECT a.*, u.username as artist_name, u.id as artist_id, u.is_verified as artist_verified
       FROM albums a 
       JOIN users u ON a.artist_id = u.id 
       WHERE a.id = ?`,
      [albumId]
    );

    if (!album) {
      return res.status(404).json({ error: 'Альбом не найден' });
    }

    if (album.cover_url && !album.cover_url.startsWith('http') && !album.cover_url.startsWith('/uploads/')) {
      album.cover_url = `/uploads/albums/${album.cover_url}`;
    }

    const tracks = await getAll<any>(
      `SELECT 
        t.*,
        json_object('id', u.id, 'username', u.username, 'is_verified', u.is_verified) as artist
       FROM tracks t
       JOIN users u ON t.artist_id = u.id
       WHERE t.album_id = ? 
       ORDER BY COALESCE(t.track_number, 999) ASC, t.title ASC`,
      [albumId]
    );

const parsedTracks = tracks.map((track: any) => {
      if (track.cover_url && !track.cover_url.startsWith('http') && !track.cover_url.startsWith('/uploads/')) {
        track.cover_url = `/uploads/tracks/${track.cover_url}`;
      }
      return {
        ...track,
        artist: JSON.parse(track.artist),
      };
    });

    const fullAlbum = {
      ...album,
      tracks: parsedTracks,
    };

    res.json(fullAlbum);
  } catch (error) {
    console.error('Get album error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
