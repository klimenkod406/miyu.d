import { Router, Response } from 'express';
import { runQuery, getOne, getAll } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { createNotification } from './notifications';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const following = await getAll<any>(`
      SELECT u.id, u.username, u.avatar_url, u.bio, u.is_verified, u.is_premium, u.role, u.created_at,
             ap.stage_name, ap.genre, ap.total_plays
      FROM follows f
      JOIN users u ON f.following_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC
    `, [userId]);

    res.json(following.map(u => ({
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
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/followers', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const followers = await getAll<any>(`
      SELECT u.id, u.username, u.avatar_url, u.bio, u.is_verified, u.is_premium, u.role, u.created_at,
             ap.stage_name, ap.genre, ap.total_plays
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      WHERE f.following_id = ?
      ORDER BY f.created_at DESC
    `, [userId]);

    res.json(followers.map(u => ({
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
    console.error('Get followers error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/count', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
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
    console.error('Get counts error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/follow', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const targetUserId = parseInt(req.body.userId, 10);

    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Не указан пользователь' });
    }

    if (userId === targetUserId) {
      return res.status(400).json({ error: 'Нельзя подписаться на себя' });
    }

    const targetUser = await getOne<any>('SELECT id FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const existing = await getOne<any>(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      [userId, targetUserId]
    );

    if (existing) {
      return res.status(400).json({ error: 'Вы уже подписаны' });
    }

    await runQuery(
      'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
      [userId, targetUserId]
    );

    const sender = await getOne<{ username: string }>('SELECT username FROM users WHERE id = ?', [userId]);
    if (sender) {
      await createNotification(targetUserId, 'follow', userId, null, null, 'подписался на вас');
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/unfollow', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const targetUserId = parseInt(req.body.userId, 10);

    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Не указан пользователь' });
    }

    await runQuery(
      'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
      [userId, targetUserId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/status/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const targetUserId = parseInt(req.params.userId as string);

    if (!targetUserId) {
      return res.status(400).json({ error: 'Не указан пользователь' });
    }

    const follow = await getOne<any>(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      [currentUserId, targetUserId]
    );

    res.json({ is_following: !!follow });
  } catch (error) {
    console.error('Get follow status error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;