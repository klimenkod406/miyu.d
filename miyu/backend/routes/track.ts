import { Router, Response, Request } from 'express';
import { getOne, runQuery } from '../db';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { checkAchievementsForUser } from './user-achievements';

const router = Router();

function normalizePlayableSourcePlaylistId(playlistId: any): number | null {
  const parsed = Number(playlistId);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const trackId = parseInt(req.params.id as string);

    const track = await getOne<any>(
      `SELECT t.*, u.username as artist_name, u.id as artist_id, a.title as album_title, a.id as album_id, a.cover_url as album_cover
       FROM tracks t
       JOIN users u ON t.artist_id = u.id
       LEFT JOIN albums a ON t.album_id = a.id
       WHERE t.id = ?`,
      [trackId]
    );

    if (!track) {
      return res.status(404).json({ error: 'Трек не найден' });
    }

    let coverUrl = track.cover_url;
    if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/')) {
      coverUrl = `/uploads/tracks/${coverUrl}`;
    }

    let albumCoverUrl = track.album_cover;
    if (albumCoverUrl && !albumCoverUrl.startsWith('http') && !albumCoverUrl.startsWith('/uploads/')) {
      albumCoverUrl = `/uploads/albums/${albumCoverUrl}`;
    }

    res.json({
      ...track,
      cover_url: coverUrl,
      album: track.album_id ? { id: track.album_id, title: track.album_title, cover_url: albumCoverUrl } : null,
    });
  } catch (error) {
    console.error('Get track error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/play', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const trackId = parseInt(req.params.id as string);
    const { duration, playlistId, completed } = req.body;
    const userId = req.user!.id;

    console.log('[track.ts] Recording play:', { trackId, userId, duration, playlistId, completed });

    const normalizedPlaylistId = normalizePlayableSourcePlaylistId(playlistId);

    await runQuery(
      'INSERT INTO track_plays (track_id, user_id, playlist_id, play_duration, completed) VALUES (?, ?, ?, ?, ?)',
      [trackId, userId, normalizedPlaylistId, duration || 0, completed ? 1 : 0]
    );

    console.log('[track.ts] Play recorded successfully');

    const unlockedAchievements = await checkAchievementsForUser(userId);

    console.log('[track.ts] Unlocked achievements:', unlockedAchievements.length);

    res.json({ message: 'Play recorded', unlockedAchievements });
  } catch (error) {
    console.error('Record play error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
