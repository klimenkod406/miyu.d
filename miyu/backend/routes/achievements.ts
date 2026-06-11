import express from 'express';
import { getAll, getOne, runQuery } from '../db';
import { optionalAuth, authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/', optionalAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id;

  if (!userId) {
    const achievements = await getAll<any>(`
      SELECT 
        a.id, a.code, a.title, a.description, a.icon, 
        a.requirement_type, a.requirement_value, a.is_secret, a.rarity,
        (SELECT COUNT(*) FROM user_achievements WHERE achievement_id = a.id) as unlock_count,
        (SELECT COUNT(*) FROM users) as total_users
      FROM achievements a
      ORDER BY a.id
    `);
    return res.json(achievements.map((a: any) => ({ 
      ...a, 
      unlocked: false, 
      progress: 0,
      unlock_percentage: a.total_users > 0 ? Math.round((a.unlock_count / a.total_users) * 100) : 0
    })));
  }

  const userAchievements = await getAll<any>(`
    SELECT achievement_id, unlocked_at
    FROM user_achievements
    WHERE user_id = ?
  `, [userId]);

  const unlockedMap = new Map(userAchievements.map((ua: any) => [ua.achievement_id, ua.unlocked_at]));

  const userLikes = await getOne<any>(`SELECT COUNT(*) as count FROM likes WHERE user_id = ?`, [userId]);
  const userPlaylists = await getOne<any>(`SELECT COUNT(*) as count FROM playlists WHERE user_id = ?`, [userId]);
  const userFriends = await getOne<any>(`
    SELECT COUNT(*) as count FROM friendships 
    WHERE (user_id = ? OR friend_id = ?) AND status = 'accepted'
  `, [userId, userId]);
  const userMinutes = await getOne<any>(`
    SELECT COALESCE(SUM(play_duration), 0) as total FROM track_plays WHERE user_id = ?
  `, [userId]);
  const newArtists = await getOne<any>(`
    SELECT COUNT(DISTINCT t.artist_id) as count FROM track_plays tp
    JOIN tracks t ON tp.track_id = t.id
    WHERE tp.user_id = ?
  `, [userId]);
  const tracksPlayed = await getOne<any>(`SELECT COUNT(*) as count FROM track_plays WHERE user_id = ?`, [userId]);
  const premium = await getOne<any>(`
    SELECT 1 as has_premium FROM subscriptions 
    WHERE user_id = ? AND status = 'active' LIMIT 1
  `, [userId]);

  const stats: Record<string, number> = {
    likes: userLikes?.count || 0,
    tracks_played: tracksPlayed?.count || 0,
    playlists_created: userPlaylists?.count || 0,
    friends_added: Math.floor((userFriends?.count || 0) / 2),
    total_minutes: Math.floor((userMinutes?.total || 0) / 60),
    new_artists: newArtists?.count || 0,
    premium: premium ? 1 : 0,
  };

  const achievements = await getAll<any>(`
    SELECT 
      a.id, a.code, a.title, a.description, a.icon, 
      a.requirement_type, a.requirement_value, a.is_secret, a.rarity,
      (SELECT COUNT(*) FROM user_achievements WHERE achievement_id = a.id) as unlock_count,
      (SELECT COUNT(*) FROM users) as total_users
    FROM achievements a
    ORDER BY a.id
  `);

  const result = achievements.map((ach: any) => {
    const unlockedAt = unlockedMap.get(ach.id);
    let isSecret = ach.is_secret === 1;

    if (isSecret && !unlockedAt) {
      return null;
    }

    let current: number;
    let progress: number;

    if (unlockedAt) {
      current = ach.requirement_value;
      progress = 100;
    } else {
      current = Math.min(stats[ach.requirement_type] || 0, ach.requirement_value);
      progress = current >= ach.requirement_value ? 100 : Math.round((current / ach.requirement_value) * 100);
    }

    return {
      ...ach,
      progress,
      current,
      unlocked: !!unlockedAt,
      unlocked_at: unlockedAt,
      unlock_percentage: ach.total_users > 0 ? Math.round((ach.unlock_count / ach.total_users) * 100) : 0
    };
  }).filter(Boolean);

  res.json(result);
});

router.get('/showcase', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const totalUsers = await getOne<{count: number}>(`SELECT COUNT(*) as count FROM users`);
    const total = totalUsers?.count || 1;

    const showcase = await getAll<any>(`
      SELECT s.achievement_id, a.id, a.code, a.title, a.description, a.icon, a.rarity, s.position,
        (SELECT COUNT(*) FROM user_achievements WHERE achievement_id = a.id) as unlock_count
      FROM achievement_showcase s
      JOIN achievements a ON s.achievement_id = a.id
      WHERE s.user_id = ?
      ORDER BY s.position
    `, [userId]);

    const result = showcase.map((s: any) => ({
      ...s,
      unlock_count: s.unlock_count || 0,
      unlock_percentage: Math.round((s.unlock_count / total) * 100)
    }));

    res.json(result);
  } catch (error) {
    console.error('Get showcase error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/showcase', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { achievementIds } = req.body;

    if (!Array.isArray(achievementIds)) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }

    await runQuery(`DELETE FROM achievement_showcase WHERE user_id = ?`, [userId]);

    for (let i = 0; i < achievementIds.length; i++) {
      await runQuery(`
        INSERT INTO achievement_showcase (user_id, achievement_id, position) VALUES (?, ?, ?)
      `, [userId, achievementIds[i], i]);
    }

    res.json({ message: 'Витрина обновлена' });
  } catch (error) {
    console.error('Update showcase error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/user/:userId', async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId as string);

    const userAchievements = await getAll<any>(`
      SELECT achievement_id, unlocked_at
      FROM user_achievements
      WHERE user_id = ?
    `, [userId]);

    const unlockedMap = new Map(userAchievements.map((ua: any) => [ua.achievement_id, ua.unlocked_at]));

    const userLikes = await getOne<any>(`SELECT COUNT(*) as count FROM likes WHERE user_id = ?`, [userId]);
    const userPlaylists = await getOne<any>(`SELECT COUNT(*) as count FROM playlists WHERE user_id = ?`, [userId]);
    const userFriends = await getOne<any>(`
      SELECT COUNT(*) as count FROM friendships 
      WHERE (user_id = ? OR friend_id = ?) AND status = 'accepted'
    `, [userId, userId]);
    const userMinutes = await getOne<any>(`
      SELECT COALESCE(SUM(play_duration), 0) as total FROM track_plays WHERE user_id = ?
    `, [userId]);
    const newArtists = await getOne<any>(`
      SELECT COUNT(DISTINCT t.artist_id) as count FROM track_plays tp
      JOIN tracks t ON tp.track_id = t.id
      WHERE tp.user_id = ?
    `, [userId]);
    const tracksPlayed = await getOne<any>(`SELECT COUNT(*) as count FROM track_plays WHERE user_id = ?`, [userId]);
    const premium = await getOne<any>(`
      SELECT 1 as has_premium FROM subscriptions 
      WHERE user_id = ? AND status = 'active' LIMIT 1
    `, [userId]);

    const stats: Record<string, number> = {
      likes: userLikes?.count || 0,
      tracks_played: tracksPlayed?.count || 0,
      playlists_created: userPlaylists?.count || 0,
      friends_added: Math.floor((userFriends?.count || 0) / 2),
      total_minutes: Math.floor((userMinutes?.total || 0) / 60),
      new_artists: newArtists?.count || 0,
      premium: premium ? 1 : 0,
    };

    const achievements = await getAll<any>(`
      SELECT 
        a.id, a.code, a.title, a.description, a.icon, 
        a.requirement_type, a.requirement_value, a.is_secret, a.rarity
      FROM achievements a
      ORDER BY a.id
    `);

    const result = achievements.map((ach: any) => {
      const unlockedAt = unlockedMap.get(ach.id);

      let current: number;
      let progress: number;

      if (unlockedAt) {
        current = ach.requirement_value;
        progress = 100;
      } else {
        current = Math.min(stats[ach.requirement_type] || 0, ach.requirement_value);
        progress = current >= ach.requirement_value ? 100 : Math.round((current / ach.requirement_value) * 100);
      }

      return {
        id: ach.id,
        code: ach.code,
        title: ach.title,
        description: ach.description,
        icon: ach.icon,
        requirement_type: ach.requirement_type,
        requirement_value: ach.requirement_value,
        is_secret: ach.is_secret,
        rarity: ach.rarity,
        progress,
        current,
        unlocked: !!unlockedAt,
        unlocked_at: unlockedAt
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get user achievements error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;