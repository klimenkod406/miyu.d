
import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer, { FileFilterCallback } from 'multer';
import { db, runQuery, getOne, getAll } from '../db';
import { authenticateToken, authorizeRole, AuthRequest } from '../middleware/auth';
import { createNotification } from './notifications';

const router = Router();

const avatarUploadDir = path.resolve(process.cwd(), 'uploads/avatars');
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, avatarUploadDir),
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (!/^image\//.test(file.mimetype)) {
      cb(new Error('Можно загружать только изображения'));
      return;
    }
    cb(null, true);
  },
});

interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: number;
  is_premium: number;
  premium_expires_at: string | null;
  created_at: string;
}

router.get('/users', authenticateToken, authorizeRole(['admin']), async (_req: AuthRequest, res: Response) => {
  try {
    const users = await getAll<User>('SELECT id, email, username, role, is_verified, is_premium, created_at FROM users ORDER BY id DESC LIMIT 50');
    res.json(users);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/artists', authenticateToken, authorizeRole(['admin']), async (_req: AuthRequest, res: Response) => {
    try {
      const artists = await getAll<User>("SELECT id, username FROM users WHERE role = 'artist' ORDER BY username");
      res.json(artists);
    } catch (error) {
      console.error('Admin get artists error:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

router.get('/artist-applications', authenticateToken, authorizeRole(['admin']), async (_req: AuthRequest, res: Response) => {
  try {
    const applications = await getAll<any>(`
      SELECT aa.id, aa.user_id, aa.type, aa.message, aa.links, aa.reason, aa.status, aa.created_at, aa.updated_at, aa.reviewed_at,
             u.username, u.email, u.avatar_url, u.bio,
             reviewer.username as reviewed_by_username
      FROM artist_applications aa
      JOIN users u ON u.id = aa.user_id
      LEFT JOIN users reviewer ON reviewer.id = aa.reviewed_by
      ORDER BY CASE aa.status WHEN 'pending' THEN 0 ELSE 1 END, aa.created_at DESC
    `);

    res.json(applications);
  } catch (error) {
    console.error('Admin artist applications error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/artist-applications/:id', authenticateToken, authorizeRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const applicationId = parseInt(req.params.id as string, 10);
    const status = String(req.body?.status || '').trim();

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Неверный статус заявки' });
    }

    const application = await getOne<any>('SELECT id, user_id, type, reason, status FROM artist_applications WHERE id = ?', [applicationId]);
    if (!application) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    await runQuery('BEGIN TRANSACTION');

    await runQuery(
      `UPDATE artist_applications
       SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, req.user!.id, applicationId],
    );

    if (status === 'approved') {
      if (application.type === 'delete') {
        await runQuery('UPDATE users SET role = ? WHERE id = ?', ['user', application.user_id]);
        await createNotification(
          application.user_id,
          'artist_page_deleted',
          req.user!.id,
          'artist_application',
          applicationId,
          `Ваша страница артиста была удалена администратором. Причина: ${application.reason || 'не указана'}`,
        );
      } else {
        await runQuery('UPDATE users SET role = ? WHERE id = ?', ['artist', application.user_id]);
        await runQuery(
          `INSERT OR IGNORE INTO artist_profiles (user_id)
           VALUES (?)`,
          [application.user_id],
        );
      }
    }

    await runQuery('COMMIT');

    res.json({ message: status === 'approved' ? 'Заявка одобрена' : 'Заявка отклонена' });
  } catch (error) {
    await runQuery('ROLLBACK');
    console.error('Admin review artist application error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/artists/:userId/remove', authenticateToken, authorizeRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string, 10);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    if (!reason) {
      return res.status(400).json({ error: 'Укажите причину удаления страницы артиста' });
    }

    const user = await getOne<any>('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!user || user.role !== 'artist') {
      return res.status(404).json({ error: 'Артист не найден' });
    }

    await runQuery('UPDATE users SET role = ? WHERE id = ?', ['user', userId]);

    await createNotification(
      userId,
      'artist_page_deleted',
      req.user!.id,
      'artist_page',
      userId,
      `Ваша страница артиста была удалена администратором. Причина: ${reason}`,
    );

    res.json({ message: 'Страница артиста удалена' });
  } catch (error) {
    console.error('Admin remove artist page error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/artists/:userId/avatar', authenticateToken, authorizeRole(['admin']), avatarUpload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string, 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      if (req.file?.path) fs.unlink(req.file.path, () => undefined);
      return res.status(400).json({ error: 'Неверный идентификатор артиста' });
    }

    const avatarFile = req.file;
    if (!avatarFile) {
      return res.status(400).json({ error: 'Файл аватара обязателен' });
    }

    const user = await getOne<any>('SELECT id, username, role, avatar_url FROM users WHERE id = ?', [userId]);
    if (!user) {
      fs.unlink(avatarFile.path, () => undefined);
      return res.status(404).json({ error: 'Артист не найден' });
    }

    if (user.role !== 'artist') {
      fs.unlink(avatarFile.path, () => undefined);
      return res.status(400).json({ error: 'Пользователь не является артистом' });
    }

    const avatarUrl = `/uploads/avatars/${avatarFile.filename}`;

    if (user.avatar_url && user.avatar_url.startsWith('/uploads/avatars/')) {
      const oldFilename = user.avatar_url.replace('/uploads/avatars/', '');
      if (oldFilename && oldFilename !== avatarFile.filename) {
        const oldPath = path.join(avatarUploadDir, oldFilename);
        fs.unlink(oldPath, () => undefined);
      }
    }

    await runQuery('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);

    res.json({ avatar_url: avatarUrl, username: user.username });
  } catch (error) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => undefined);
    }
    console.error('Admin upload artist avatar error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/users/:id/role', authenticateToken, authorizeRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);
    const { role } = req.body;

    if (!['user', 'artist', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Неверная роль' });
    }

    await runQuery('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

    if (role === 'artist') {
      await runQuery(
        `INSERT OR IGNORE INTO artist_profiles (user_id)
         VALUES (?)`,
        [userId],
      );
    }

    res.json({ message: 'Роль обновлена' });
  } catch (error) {
    console.error('Admin update role error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
