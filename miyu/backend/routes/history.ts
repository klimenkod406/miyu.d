import { Router, Response } from 'express'
import { getAll } from '../db'
import { authenticateToken } from '../middleware/auth'

const router = Router()

function normalizePlayableSourcePlaylistId(playlistId: any): number | null {
  const parsed = Number(playlistId)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

// GET /api/history - получить историю прослушивания пользователя
router.get('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id

    console.log('[history.ts] Fetching history for user:', userId)

    const history = await getAll<any>(
      `SELECT
        tp.id,
        tp.track_id,
        tp.playlist_id,
        tp.play_duration,
        tp.completed,
        tp.created_at,
        t.title,
        t.duration,
        t.cover_url,
        t.file_path,
        a.id as album_id,
        a.title as album_title,
        a.cover_url as album_cover_url,
        u.id as artist_id,
        u.username as artist_name,
        u.avatar_url as artist_avatar,
        p.id as playlist_id_full,
        p.title as playlist_title
      FROM track_plays tp
      JOIN tracks t ON tp.track_id = t.id
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN users u ON t.artist_id = u.id
      LEFT JOIN playlists p ON tp.playlist_id = p.id
      WHERE tp.user_id = ?
      ORDER BY tp.created_at DESC
      LIMIT 100`,
      [userId]
    )

    console.log('[history.ts] Found', history.length, 'history items')

    // Форматируем данные
    const formattedHistory = history.map((item: any) => ({
      id: item.id,
      playedAt: item.created_at,
      playDuration: item.play_duration,
      completed: item.completed === 1,
      playlistId: item.playlist_id,
      playlist: item.playlist_id_full ? {
        id: item.playlist_id_full,
        title: item.playlist_title
      } : null,
      track: {
        id: item.track_id,
        title: item.title,
        duration: item.duration,
        cover_url: item.cover_url,
        file_path: item.file_path,
        album: item.album_id ? {
          id: item.album_id,
          title: item.album_title,
          cover_url: item.album_cover_url
        } : null,
        artist: {
          id: item.artist_id,
          username: item.artist_name,
          avatar_url: item.artist_avatar
        }
      }
    }))

    res.json(formattedHistory)
  } catch (error) {
    console.error('Error fetching listening history:', error)
    res.status(500).json({ error: 'Failed to fetch listening history' })
  }
})

// POST /api/history - добавить запись в историю прослушивания
router.post('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id
    const { trackId, playDuration, completed, playlistId } = req.body

    console.log('[history.ts] Recording play:', { trackId, userId, playDuration, completed, playlistId })

    if (!trackId || playDuration === undefined) {
      return res.status(400).json({ error: 'trackId and playDuration are required' })
    }

    const db = await import('../db').then(m => m.db)
    const normalizedPlaylistId = normalizePlayableSourcePlaylistId(playlistId)

    const result: any = await db.run(
      `INSERT INTO track_plays (track_id, user_id, playlist_id, play_duration, completed)
       VALUES (?, ?, ?, ?, ?)`,
      [trackId, userId, normalizedPlaylistId, playDuration, completed ? 1 : 0]
    )

    console.log('[history.ts] Play recorded successfully, id:', result.lastID)

    res.json({
      success: true,
      id: result.lastID,
      message: 'Play recorded'
    })
  } catch (error) {
    console.error('Error recording play:', error)
    res.status(500).json({ error: 'Failed to record play' })
  }
})

export default router
