import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, runQuery, getOne, getAll } from '../db';
import { generateTokens, verifyRefreshToken, authenticateToken, AuthRequest } from '../middleware/auth';
import crypto from 'crypto';
import { sendEmail } from '../services/emailService';
import { passwordResetEmail } from '../services/emailTemplates';

const forgotPasswordRateLimit = new Map<string, number[]>();
const FORGOT_MAX_REQUESTS = 3;
const FORGOT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const router = Router();

interface User {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: number;
  is_premium: number;
  premium_expires_at: string | null;
  created_at: string;
}

interface RefreshToken {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    const existingEmail = await getOne<User>('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email уже используется' });
    }

    const existingUsername = await getOne<User>('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUsername) {
      return res.status(400).json({ error: 'Имя пользователя уже занято' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await runQuery(
      'INSERT INTO users (email, username, password_hash, role) VALUES (?, ?, ?, ?)',
      [email, username, passwordHash, 'user']
    );

    const userId = result.lastID;

    await runQuery(
      'INSERT INTO playlists (user_id, title, description, is_public, is_system) VALUES (?, ?, ?, ?, ?)',
      [userId, 'Liked', 'Лайкнутые треки', 0, 1]
    );

    const user = await getOne<User>('SELECT id, email, username, role FROM users WHERE id = ?', [userId]);
    
    if (!user) {
      return res.status(500).json({ error: 'Ошибка при создании пользователя' });
    }

    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    });

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
    
    await runQuery(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, tokens.refreshToken, refreshExpiresAt.toISOString()]
    );

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatar_url: null,
        bio: null,
        is_verified: false,
        is_premium: false
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    console.log('Login request body:', req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }

    const user = await getOne<User>('SELECT * FROM users WHERE email = ?', [email]);
    console.log('Found user:', user);

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    console.log('Comparing password...');
    const validPassword = await bcrypt.compare(password, user.password_hash);
    console.log('Password valid:', validPassword);

    if (!validPassword) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    console.log('Generating tokens...');
    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    });

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
    
    await runQuery(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, tokens.refreshToken, refreshExpiresAt.toISOString()]
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatar_url: user.avatar_url,
        bio: user.bio,
        is_verified: !!user.is_verified,
        is_premium: !!user.is_premium,
        premium_expires_at: user.premium_expires_at
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Токен не предоставлен' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Неверльный тип токена' });
    }

    const storedToken = await getOne<RefreshToken>(
      'SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ?',
      [refreshToken, decoded.id]
    );

    if (!storedToken) {
      return res.status(401).json({ error: 'Токен не найден' });
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      await runQuery('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
      return res.status(401).json({ error: 'Токен истек' });
    }

    const user = await getOne<User>('SELECT id, email, username, role FROM users WHERE id = ?', [decoded.id]);
    
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    await runQuery('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);

    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    });

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
    
    await runQuery(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, tokens.refreshToken, refreshExpiresAt.toISOString()]
    );

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(401).json({ error: 'Неверльный токен' });
  }
});

router.post('/logout', async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await runQuery('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }

    if (req.user) {
      await runQuery('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id]);
    }

    res.json({ message: 'Вышел из системы' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = await getOne<User>(
      `SELECT id, email, username, role, avatar_url, bio, is_verified,
              is_premium, premium_expires_at, created_at,
              palette_mode, palette_primary, palette_secondary, palette_tertiary, palette_accent
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      avatar_url: user.avatar_url,
      bio: user.bio,
      is_verified: !!user.is_verified,
      is_premium: !!user.is_premium,
      premium_expires_at: user.premium_expires_at,
      created_at: user.created_at,
      palette_mode: (user as any).palette_mode || 'auto',
      palette_primary: (user as any).palette_primary,
      palette_secondary: (user as any).palette_secondary,
      palette_tertiary: (user as any).palette_tertiary,
      palette_accent: (user as any).palette_accent
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Укажите email' });
    }

    // Rate limit check
    const now = Date.now();
    const key = email.toLowerCase();
    const timestamps = forgotPasswordRateLimit.get(key) || [];
    const recent = timestamps.filter(t => now - t < FORGOT_WINDOW_MS);
    if (recent.length >= FORGOT_MAX_REQUESTS) {
      return res.status(429).json({ error: 'Слишком много запросов. Попробуйте позже.' });
    }
    recent.push(now);
    forgotPasswordRateLimit.set(key, recent);

    // Find user (but don't reveal if exists — anti-enumeration)
    const user = await getOne<{ id: number }>('SELECT id FROM users WHERE email = ?', [email]);
    if (user) {
      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(now + 3600000).toISOString(); // +1 hour

      await runQuery(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, token, expiresAt]
      );

      // Fire-and-forget email
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${token}`;
      sendEmail(email, 'Miyu — Сброс пароля', passwordResetEmail(resetLink))
        .catch(err => console.error('[EMAIL] Forgot password send failed:', err.message));
    }

    // Always same response (anti-enumeration)
    res.json({ message: 'Если аккаунт с таким email существует, письмо со ссылкой для сброса отправлено' });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Токен и новый пароль обязательны' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    // Find valid token
    const resetRecord = await getOne<{ id: number; user_id: number; expires_at: string }>(
      'SELECT id, user_id, expires_at FROM password_reset_tokens WHERE token = ? AND used = 0',
      [token]
    );

    if (!resetRecord) {
      return res.status(400).json({ error: 'Ссылка недействительна или истекла. Запросите новую.' });
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Ссылка недействительна или истекла. Запросите новую.' });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(password, 10);
    await runQuery('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, resetRecord.user_id]);

    // Mark token as used
    await runQuery('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [resetRecord.id]);

    // Invalidate all refresh tokens for this user (force re-login everywhere)
    await runQuery('DELETE FROM refresh_tokens WHERE user_id = ?', [resetRecord.user_id]);

    res.json({ message: 'Пароль успешно изменен. Войдите с новым паролем.' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
export default router;