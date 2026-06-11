import express from 'express';
import { getAll, getOne, runQuery } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use((req, res, next) => {
  console.log('[user-achievements] Request:', req.method, req.path, 'full:', req.originalUrl);
  next();
});

export async function checkAchievementsForUser(userId: number): Promise<any[]> {
  const unlockedAchievements: any[] = [];

  const achievements = await getAll<any>(`
    SELECT id, requirement_type, requirement_value, code, title, description, icon, rarity
    FROM achievements
  `);

  const userUnlocked = await getAll<any>(`
    SELECT achievement_id FROM user_achievements WHERE user_id = ?
  `, [userId]);
  const unlockedIds = new Set(userUnlocked.map((ua: any) => ua.achievement_id));

  const userLikes = await getOne<any>(`SELECT COUNT(*) as count FROM likes WHERE user_id = ?`, [userId]);
  const userPlaylists = await getOne<any>(`SELECT COUNT(*) as count FROM playlists WHERE user_id = ?`, [userId]);
  const userFriends = await getOne<any>(`
    SELECT COUNT(*) as count FROM friendships
    WHERE (user_id = ? OR friend_id = ?) AND status = 'accepted'
  `, [userId, userId]);
  const userMinutes = await getOne<any>(`
    SELECT COALESCE(SUM(play_duration), 0) as total FROM track_plays WHERE user_id = ?
  `, [userId]);
  const tracksPlayed = await getOne<any>(`SELECT COUNT(*) as count FROM track_plays WHERE user_id = ?`, [userId]);
  const premium = await getOne<any>(`
    SELECT 1 as has_premium FROM subscriptions
    WHERE user_id = ? AND status = 'active' LIMIT 1
  `, [userId]);

  const albumsLiked = await getOne<any>(`SELECT COUNT(*) as count FROM album_likes WHERE user_id = ?`, [userId]);
  const artistsFollowed = await getOne<any>(`SELECT COUNT(*) as count FROM artist_follows WHERE user_id = ?`, [userId]);
  const ticketsPurchased = await getOne<any>(`SELECT COUNT(*) as count FROM tickets WHERE user_id = ?`, [userId]);
  const videosWatched = await getOne<any>(`SELECT COUNT(DISTINCT video_id) as count FROM video_views WHERE user_id = ?`, [userId]);

  const nightOwlPlays = await getOne<any>(`
    SELECT COUNT(*) as count FROM track_plays
    WHERE user_id = ? AND (strftime('%H', played_at) >= '22' OR strftime('%H', played_at) < '06')
  `, [userId]);

  const earlyBirdPlays = await getOne<any>(`
    SELECT COUNT(*) as count FROM track_plays
    WHERE user_id = ? AND strftime('%H', played_at) >= '06' AND strftime('%H', played_at) < '10'
  `, [userId]);

  const stats: Record<string, number> = {
    likes: userLikes?.count || 0,
    tracks_played: tracksPlayed?.count || 0,
    playlists_created: userPlaylists?.count || 0,
    friends_added: userFriends?.count || 0,
    total_minutes: Math.floor((userMinutes?.total || 0) / 60),
    premium: premium ? 1 : 0,
    albums_liked: albumsLiked?.count || 0,
    artists_followed: artistsFollowed?.count || 0,
    tickets_purchased: ticketsPurchased?.count || 0,
    videos_watched: videosWatched?.count || 0,
    night_owl: nightOwlPlays?.count || 0,
    early_bird: earlyBirdPlays?.count || 0,
  };

  for (const ach of achievements) {
    if (unlockedIds.has(ach.id)) continue;

    const current = stats[ach.requirement_type] || 0;
    if (current >= ach.requirement_value) {
      await runQuery(`
        INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)
      `, [userId, ach.id]);
      unlockedAchievements.push({
        id: ach.id,
        code: ach.code,
        title: ach.title,
        description: ach.description,
        icon: ach.icon,
        rarity: ach.rarity
      });
    }
  }

  return unlockedAchievements;
}

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  console.log('[user-achievements] GET / handler reached');
  try {
    const userId = req.user!.id;
    await checkAchievementsForUser(userId);

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
    const tracksPlayed = await getOne<any>(`SELECT COUNT(*) as count FROM track_plays WHERE user_id = ?`, [userId]);
    const premium = await getOne<any>(`
      SELECT 1 as has_premium FROM subscriptions
      WHERE user_id = ? AND status = 'active' LIMIT 1
    `, [userId]);

    const albumsLiked = await getOne<any>(`SELECT COUNT(*) as count FROM album_likes WHERE user_id = ?`, [userId]);
    const artistsFollowed = await getOne<any>(`SELECT COUNT(*) as count FROM artist_follows WHERE user_id = ?`, [userId]);
    const ticketsPurchased = await getOne<any>(`SELECT COUNT(*) as count FROM tickets WHERE user_id = ?`, [userId]);
    const videosWatched = await getOne<any>(`SELECT COUNT(DISTINCT video_id) as count FROM video_views WHERE user_id = ?`, [userId]);

    const nightOwlPlays = await getOne<any>(`
      SELECT COUNT(*) as count FROM track_plays
      WHERE user_id = ? AND (strftime('%H', played_at) >= '22' OR strftime('%H', played_at) < '06')
    `, [userId]);

    const earlyBirdPlays = await getOne<any>(`
      SELECT COUNT(*) as count FROM track_plays
      WHERE user_id = ? AND strftime('%H', played_at) >= '06' AND strftime('%H', played_at) < '10'
    `, [userId]);

    const userStats = {
      likes: userLikes?.count || 0,
      tracks_played: tracksPlayed?.count || 0,
      playlists_created: userPlaylists?.count || 0,
      friends_added: userFriends?.count || 0,
      total_minutes: Math.floor((userMinutes?.total || 0) / 60),
      has_premium: !!premium,
      albums_liked: albumsLiked?.count || 0,
      artists_followed: artistsFollowed?.count || 0,
      tickets_purchased: ticketsPurchased?.count || 0,
      videos_watched: videosWatched?.count || 0,
      night_owl: nightOwlPlays?.count || 0,
      early_bird: earlyBirdPlays?.count || 0,
    };

    const achievements = await getAll<any>(`
      SELECT 
        a.id, a.code, a.title, a.description, a.icon, 
        a.requirement_type, a.requirement_value, a.rarity,
        (SELECT COUNT(*) FROM user_achievements WHERE achievement_id = a.id) as unlock_count,
        (SELECT COUNT(*) FROM users) as total_users
      FROM achievements a
      ORDER BY a.id
    `);

    const result = achievements.map((ach: any) => {
      const unlockedAt = unlockedMap.get(ach.id);
      let progress = 0;
      let current = 0;

      if (unlockedAt) {
        current = ach.requirement_value;
        progress = 100;
      } else {
        switch (ach.requirement_type) {
          case 'tracks_played':
            current = Math.min(userStats.tracks_played, ach.requirement_value);
            break;
          case 'likes':
            current = Math.min(userStats.likes, ach.requirement_value);
            break;
          case 'playlists_created':
            current = Math.min(userStats.playlists_created, ach.requirement_value);
            break;
          case 'friends_added':
            current = Math.min(userStats.friends_added, ach.requirement_value);
            break;
          case 'total_minutes':
            current = Math.min(userStats.total_minutes, ach.requirement_value);
            break;
          case 'premium':
            current = userStats.has_premium ? 1 : 0;
            break;
          case 'albums_liked':
            current = Math.min(userStats.albums_liked, ach.requirement_value);
            break;
          case 'artists_followed':
            current = Math.min(userStats.artists_followed, ach.requirement_value);
            break;
          case 'tickets_purchased':
            current = Math.min(userStats.tickets_purchased, ach.requirement_value);
            break;
          case 'videos_watched':
            current = Math.min(userStats.videos_watched, ach.requirement_value);
            break;
          case 'night_owl':
            current = Math.min(userStats.night_owl, ach.requirement_value);
            break;
          case 'early_bird':
            current = Math.min(userStats.early_bird, ach.requirement_value);
            break;
          default:
            current = 0;
        }
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
    });

    res.json(result);
  } catch (error) {
    console.error('Get user achievements error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/showcase', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const showcase = await getAll<any>(`
      SELECT s.achievement_id, a.id, a.code, a.title, a.description, a.icon, a.rarity, s.position
      FROM achievement_showcase s
      JOIN achievements a ON s.achievement_id = a.id
      WHERE s.user_id = ?
      ORDER BY s.position
    `, [userId]);

    res.json(showcase);
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

export default router;