import express from 'express';
import { getAll, getOne, runQuery } from '../db';
import { authenticateToken, authorizeRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, authorizeRole(['admin']), async (_req: AuthRequest, res) => {
  try {
    const achievements = await getAll<any>(`
      SELECT 
        a.id, a.code, a.title, a.description, a.icon, 
        a.requirement_type, a.requirement_value, a.rarity, a.is_secret,
        (SELECT COUNT(*) FROM user_achievements WHERE achievement_id = a.id) as unlock_count
      FROM achievements a
      ORDER BY a.id
    `);
    res.json(achievements);
  } catch (error) {
    console.error('Admin get achievements error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', authenticateToken, authorizeRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { code, title, description, icon, requirement_type, requirement_value, rarity, is_secret } = req.body;

    if (!code || !title || !requirement_type || !requirement_value) {
      return res.status(400).json({ error: 'Заполните обязательные поля' });
    }

    const existing = await getOne<any>(`SELECT id FROM achievements WHERE code = ?`, [code as string]);
    if (existing) {
      return res.status(400).json({ error: 'Достижение с таким кодом уже существует' });
    }

    await runQuery(`
      INSERT INTO achievements (code, title, description, icon, requirement_type, requirement_value, rarity, is_secret)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      code as string,
      title as string,
      (description || '') as string,
      (icon || 'award') as string,
      requirement_type as string,
      requirement_value as number,
      (rarity || 'common') as string,
      is_secret ? 1 : 0
    ]);

    res.json({ message: 'Достижение создано' });
  } catch (error) {
    console.error('Admin create achievement error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/:id', authenticateToken, authorizeRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const achievementId = parseInt(req.params.id as string);
    const { code, title, description, icon, requirement_type, requirement_value, rarity, is_secret } = req.body;

    const existing = await getOne<any>(`SELECT id FROM achievements WHERE id = ?`, [achievementId]);
    if (!existing) {
      return res.status(404).json({ error: 'Достижение не найдено' });
    }

    if (code) {
      const duplicate = await getOne<any>(`SELECT id FROM achievements WHERE code = ? AND id != ?`, [code as string, achievementId]);
      if (duplicate) {
        return res.status(400).json({ error: 'Код уже используется' });
      }
    }

    await runQuery(`
      UPDATE achievements 
      SET code = COALESCE(?, code),
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          icon = COALESCE(?, icon),
          requirement_type = COALESCE(?, requirement_type),
          requirement_value = COALESCE(?, requirement_value),
          rarity = COALESCE(?, rarity),
          is_secret = COALESCE(?, is_secret)
      WHERE id = ?
    `, [
      code as string | null,
      title as string | null,
      description as string | null,
      icon as string | null,
      requirement_type as string | null,
      requirement_value as number | null,
      rarity as string | null,
      is_secret ? 1 : 0,
      achievementId
    ]);

    res.json({ message: 'Достижение обновлено' });
  } catch (error) {
    console.error('Admin update achievement error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const achievementId = parseInt(req.params.id as string);

    const existing = await getOne<any>(`SELECT id FROM achievements WHERE id = ?`, [achievementId]);
    if (!existing) {
      return res.status(404).json({ error: 'Достижение не найдено' });
    }

    await runQuery(`DELETE FROM user_achievements WHERE achievement_id = ?`, [achievementId]);
    await runQuery(`DELETE FROM achievements WHERE id = ?`, [achievementId]);

    res.json({ message: 'Достижение удалено' });
  } catch (error) {
    console.error('Admin delete achievement error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;