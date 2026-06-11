import { Router, Response } from 'express';
import { runQuery, getOne, getAll } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await getAll<any>(`
      SELECT n.id, n.type, n.from_user_id, n.target_type, n.target_id, n.message, n.read, n.created_at,
             u.username as from_username, u.avatar_url as from_avatar
      FROM notifications n
      LEFT JOIN users u ON n.from_user_id = u.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [req.user!.id]);

    res.json(notifications.map(n => ({
      ...n,
      from_user: n.from_user_id ? {
        id: n.from_user_id,
        username: n.from_username,
        avatar_url: n.from_avatar
      } : null
    })));
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

router.get('/unread', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await getOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0',
      [req.user!.id]
    );
    res.json({ count: result?.count || 0 });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get count' });
  }
});

router.post('/mark-read', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { ids } = req.body;
  
  try {
    if (ids && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      await runQuery(
        `UPDATE notifications SET read = 1 WHERE id IN (${placeholders}) AND user_id = ?`,
        [...ids, req.user!.id]
      );
    }
    res.json({ message: 'Marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.post('/mark-all-read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await runQuery(
      'UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0',
      [req.user!.id]
    );
    res.json({ message: 'All marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  try {
    await runQuery(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [id, req.user!.id]
    );
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export async function createNotification(
  userId: number, 
  type: string, 
  fromUserId: number | null, 
  targetType: string | null, 
  targetId: number | null, 
  message: string
) {
  await runQuery(
    `INSERT INTO notifications (user_id, type, from_user_id, target_type, target_id, message) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, type, fromUserId, targetType, targetId, message]
  );
}

export default router;