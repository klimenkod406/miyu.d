import { Router, Response } from 'express';
import { getOne, getAll, runQuery } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { createNotification } from './notifications';
import { checkAchievementsForUser } from './user-achievements';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const friends = await getAll<any>(`
      SELECT DISTINCT u.id, u.username, u.avatar_url, u.bio, u.is_verified, u.is_premium, u.role,
             f.is_pinned_in_sidebar, f.is_hidden_in_sidebar
      FROM friendships f
      JOIN users u ON (
        CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END = u.id
      )
      WHERE f.status = 'accepted' AND u.id != ? AND (f.user_id = ? OR f.friend_id = ?)
      ORDER BY f.is_pinned_in_sidebar DESC, u.username
    `, [userId, userId, userId, userId]);

    res.json(friends.map(f => ({
      id: f.id,
      username: f.username,
      avatar_url: f.avatar_url,
      bio: f.bio,
      is_verified: !!f.is_verified,
      is_premium: !!f.is_premium,
      role: f.role,
      is_pinned_in_sidebar: !!f.is_pinned_in_sidebar,
      is_hidden_in_sidebar: !!f.is_hidden_in_sidebar
    })));
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/requests', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const requests = await getAll<any>(`
      SELECT f.id, f.user_id as from_user_id, f.created_at,
             u.id as user_id, u.username, u.avatar_url, u.bio, u.is_verified, u.is_premium, u.role
      FROM friendships f
      JOIN users u ON f.user_id = u.id
      WHERE f.friend_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `, [userId]);

    res.json(requests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/accept', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: 'Не указан ID запроса' });
    }

    const request = await getOne<any>(
      'SELECT * FROM friendships WHERE id = ? AND friend_id = ? AND status = ?',
      [requestId, userId, 'pending']
    );

    if (!request) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    await runQuery(
      'UPDATE friendships SET status = ? WHERE id = ?',
      ['accepted', requestId]
    );

    // Check achievements for both users
    const unlockedAchievements = await checkAchievementsForUser(userId);
    const senderUnlockedAchievements = await checkAchievementsForUser(request.user_id);

    res.json({
      success: true,
      unlockedAchievements,
      senderUnlockedAchievements
    });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/reject', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: 'Не указан ID запроса' });
    }

    const request = await getOne<any>(
      'SELECT * FROM friendships WHERE id = ? AND friend_id = ? AND status = ?',
      [requestId, userId, 'pending']
    );

    if (!request) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    await runQuery('DELETE FROM friendships WHERE id = ?', [requestId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/request', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const targetUserId = parseInt(req.body.userId, 10);

    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Не указан пользователь' });
    }

    if (userId === targetUserId) {
      return res.status(400).json({ error: 'Нельзя добавить себя' });
    }

    const targetUser = await getOne<any>('SELECT id FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const existing = await getOne<any>(
      `SELECT id, status FROM friendships 
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [userId, targetUserId, targetUserId, userId]
    );

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ error: 'Вы уже друзья' });
      }
      if (existing.status === 'pending') {
        return res.status(400).json({ error: 'Запрос уже отправлен' });
      }
    }

    await runQuery(
      'INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)',
      [userId, targetUserId, 'pending']
    );

    const sender = await getOne<{ username: string }>('SELECT username FROM users WHERE id = ?', [userId]);
    if (sender) {
      await createNotification(targetUserId, 'friend_request', userId, null, null, `отправил вам запрос в друзья`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Send request error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/search', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const query = req.query.q as string;

    if (!query || query.length < 2) {
      return res.json([]);
    }

    const searchTerm = `%${query}%`;
    const users = await getAll<any>(`
      SELECT id, username, avatar_url, bio, is_verified, is_premium, role
      FROM users
      WHERE (username LIKE ? OR bio LIKE ?) AND id != ?
      ORDER BY 
        CASE WHEN username LIKE ? THEN 0 ELSE 1 END,
        username
      LIMIT 20
    `, [searchTerm, searchTerm, userId, `${query}%`]);

    const friends = await getAll<any>(
      `SELECT friend_id as user_id FROM friendships WHERE user_id = ? AND status = 'accepted'
       UNION 
       SELECT user_id FROM friendships WHERE friend_id = ? AND status = 'accepted'`,
      [userId, userId]
    );
    const friendIds = new Set(friends.map(f => f.user_id));

    const pending = await getAll<any>(
      `SELECT friend_id as user_id FROM friendships WHERE user_id = ? AND status = 'pending'
       UNION 
       SELECT user_id FROM friendships WHERE friend_id = ? AND status = 'pending'`,
      [userId, userId]
    );
    const pendingIds = new Set(pending.map(f => f.user_id));

    res.json(users.map(u => ({
      ...u,
      is_verified: !!u.is_verified,
      is_premium: !!u.is_premium,
      is_friend: friendIds.has(u.id),
      request_sent: pendingIds.has(u.id)
    })));
  } catch (error) {
    console.error('Search users error:', error);
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

    const friendship = await getOne<any>(`
      SELECT id, user_id, friend_id, status FROM friendships 
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    `, [currentUserId, targetUserId, targetUserId, currentUserId]);

    const follow = await getOne<any>(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      [currentUserId, targetUserId]
    );

    if (!friendship) {
      return res.json({ is_friend: false, request_sent: false, is_following: !!follow });
    }

    res.json({
      is_friend: friendship.status === 'accepted',
      request_sent: friendship.status === 'pending',
      is_initiator: friendship.user_id === currentUserId,
      is_following: !!follow
    });
  } catch (error) {
    console.error('Get friend status error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/remove', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const targetUserId = parseInt(req.body.userId, 10);

    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Не указан пользователь' });
    }

    await runQuery(
      `DELETE FROM friendships
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [userId, targetUserId, targetUserId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/pin-sidebar', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const targetUserId = parseInt(req.body.userId, 10);

    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Не указан пользователь' });
    }

    await runQuery(
      `UPDATE friendships
       SET is_pinned_in_sidebar = 1
       WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = 'accepted'`,
      [userId, targetUserId, targetUserId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Pin friend error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/unpin-sidebar', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const targetUserId = parseInt(req.body.userId, 10);

    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Не указан пользователь' });
    }

    await runQuery(
      `UPDATE friendships
       SET is_pinned_in_sidebar = 0
       WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = 'accepted'`,
      [userId, targetUserId, targetUserId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Unpin friend error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/hide-sidebar', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const targetUserId = parseInt(req.body.userId, 10);

    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Не указан пользователь' });
    }

    await runQuery(
      `UPDATE friendships
       SET is_hidden_in_sidebar = 1
       WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = 'accepted'`,
      [userId, targetUserId, targetUserId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Hide friend error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/unhide-sidebar', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const targetUserId = parseInt(req.body.userId, 10);

    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Не указан пользователь' });
    }

    await runQuery(
      `UPDATE friendships
       SET is_hidden_in_sidebar = 0
       WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = 'accepted'`,
      [userId, targetUserId, targetUserId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Unhide friend error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;