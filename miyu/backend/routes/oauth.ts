import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import passport from '../config/passport';
import { generateTokens } from '../middleware/auth';
import { runQuery, getOne } from '../db';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// Check if a passport strategy is registered
function checkOAuthStrategy(strategyName: string): boolean {
  try {
    return !!(passport as any)._strategies?.[strategyName];
  } catch {
    return false;
  }
}

// Middleware to guard routes when strategy is not configured
function requireOAuthStrategy(strategyName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!checkOAuthStrategy(strategyName)) {
      const providerName = strategyName === 'yandex' ? 'Yandex' : strategyName === 'github' ? 'GitHub' : 'VK';
      return res.status(503).contentType('text/html').send(
        renderOAuthErrorHtml(
          'Login via ' + providerName + ' is temporarily unavailable. Please try again later.'
        )
      );
    }
    next();
  };
}

// Redirect to Yandex OAuth consent screen
router.get('/yandex', requireOAuthStrategy('yandex'), passport.authenticate('yandex', { session: false }));

// Redirect to VK OAuth consent screen
router.get('/vkontakte', requireOAuthStrategy('vkontakte'), passport.authenticate('vkontakte', { session: false, scope: ['email'] }));

// Redirect to GitHub OAuth consent screen
router.get('/github', requireOAuthStrategy('github'), passport.authenticate('github', { session: false, scope: ['user:email'] }));

/**
 * Render HTML page that sends oauth-callback postMessage to the opener window
 * and then closes itself.
 */
function renderOAuthSuccessHtml(accessToken: string, refreshToken: string, user: any): string {
  const safeUser = JSON.stringify(user).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return '<!DOCTYPE html>\n' +
    '<html>\n' +
    '<head><meta charset="utf-8"><title>Авторизация...</title></head>\n' +
    '<body>\n' +
    '<script>\n' +
    '  (function() {\n' +
    "    var targetOrigin = '" + FRONTEND_URL + "';\n" +
    '    var data = {\n' +
    "      type: 'oauth-callback',\n" +
    '      accessToken: ' + JSON.stringify(accessToken) + ',\n' +
    '      refreshToken: ' + JSON.stringify(refreshToken) + ',\n' +
    '      user: ' + safeUser + '\n' +
    '    };\n' +
    '    if (window.opener) {\n' +
    '      window.opener.postMessage(data, targetOrigin);\n' +
    '    }\n' +
    '    window.close();\n' +
    '  })();\n' +
    '<\/script>\n' +
    '<p>Авторизация выполнена. Если окно не закрывается автоматически, закройте его вручную.</p>\n' +
    '</body>\n' +
    '</html>';
}

/**
 * Render HTML page that sends an error oauth-callback postMessage to the opener window
 * and then closes itself.
 */
function renderOAuthErrorHtml(errorMessage: string): string {
  return '<!DOCTYPE html>\n' +
    '<html>\n' +
    '<head><meta charset="utf-8"><title>Ошибка авторизации</title></head>\n' +
    '<body>\n' +
    '<script>\n' +
    '  (function() {\n' +
    "    var targetOrigin = '" + FRONTEND_URL + "';\n" +
    '    var data = {\n' +
    "      type: 'oauth-callback',\n" +
    '      error: ' + JSON.stringify(errorMessage) + '\n' +
    '    };\n' +
    '    if (window.opener) {\n' +
    '      window.opener.postMessage(data, targetOrigin);\n' +
    '    }\n' +
    '    window.close();\n' +
    '  })();\n' +
    '<\/script>\n' +
    '<p>' + errorMessage + '</p>\n' +
    '</body>\n' +
    '</html>';
}

/**
 * Generate a short-lived JWT for linking email after OAuth
 */
function generateTempToken(userId: number): string {
  return jwt.sign(
    { id: userId, purpose: 'link-email' },
    JWT_SECRET,
    { expiresIn: '5m' } as any
  );
}

/**
 * Render HTML page that sends oauth-callback postMessage with needsEmail flag
 * and a tempToken for subsequent email linking.
 */
function renderOAuthNeedsEmailHtml(tempToken: string): string {
  return '<!DOCTYPE html>\n' +
    '<html>\n' +
    '<head><meta charset="utf-8"><title>Требуется email</title></head>\n' +
    '<body>\n' +
    '<script>\n' +
    '  (function() {\n' +
    "    var targetOrigin = '" + FRONTEND_URL + "';\n" +
    '    var data = {\n' +
    "      type: 'oauth-callback',\n" +
    '      needsEmail: true,\n' +
    '      tempToken: ' + JSON.stringify(tempToken) + '\n' +
    '    };\n' +
    '    if (window.opener) {\n' +
    '      window.opener.postMessage(data, targetOrigin);\n' +
    '    }\n' +
    '    window.close();\n' +
    '  })();\n' +
    '<\/script>\n' +
    '<p>Требуется указать email. Если окно не закрывается автоматически, закройте его вручную.</p>\n' +
    '</body>\n' +
    '</html>';
}

// Yandex OAuth callback
router.get('/yandex/callback', (req: Request, res: Response) => {
  passport.authenticate('yandex', { session: false }, async (err: any, user: any) => {
    try {
      if (err || !user) {
        const message = err?.message || 'Ошибка авторизации через Яндекс';
        return res.status(400).contentType('text/html').send(renderOAuthErrorHtml(message));
      }

      // If user has no email, send needsEmail flow
      if (!user.email) {
        const tempToken = generateTempToken(user.id);
        return res.contentType('text/html').send(renderOAuthNeedsEmailHtml(tempToken));
      }

      const tokens = generateTokens({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      });

      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

      await runQuery(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, tokens.refreshToken, refreshExpiresAt.toISOString()]
      );

      res.contentType('text/html').send(renderOAuthSuccessHtml(tokens.accessToken, tokens.refreshToken, user));
    } catch (error) {
      console.error('Yandex OAuth callback error:', error);
      res.status(500).contentType('text/html').send(renderOAuthErrorHtml('Внутренняя ошибка сервера'));
    }
  })(req, res);
});

// VK OAuth callback
router.get('/vkontakte/callback', (req: Request, res: Response) => {
  passport.authenticate('vkontakte', { session: false }, async (err: any, user: any) => {
    try {
      if (err || !user) {
        const message = err?.message || 'Ошибка авторизации через ВКонтакте';
        return res.status(400).contentType('text/html').send(renderOAuthErrorHtml(message));
      }

      // If user has no email, send needsEmail flow
      if (!user.email) {
        const tempToken = generateTempToken(user.id);
        return res.contentType('text/html').send(renderOAuthNeedsEmailHtml(tempToken));
      }

      const tokens = generateTokens({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      });

      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

      await runQuery(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, tokens.refreshToken, refreshExpiresAt.toISOString()]
      );

      res.contentType('text/html').send(renderOAuthSuccessHtml(tokens.accessToken, tokens.refreshToken, user));
    } catch (error) {
      console.error('VK OAuth callback error:', error);
      res.status(500).contentType('text/html').send(renderOAuthErrorHtml('Внутренняя ошибка сервера'));
    }
  })(req, res);
});

// GitHub OAuth callback
router.get('/github/callback', requireOAuthStrategy('github'), (req: Request, res: Response) => {
  passport.authenticate('github', { session: false }, async (err: any, user: any) => {
    try {
      if (err || !user) {
        const message = err?.message || 'Ошибка авторизации через GitHub';
        return res.status(400).contentType('text/html').send(renderOAuthErrorHtml(message));
      }

      const tokens = generateTokens({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      });

      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

      await runQuery(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, tokens.refreshToken, refreshExpiresAt.toISOString()]
      );

      res.contentType('text/html').send(renderOAuthSuccessHtml(tokens.accessToken, tokens.refreshToken, user));
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      res.status(500).contentType('text/html').send(renderOAuthErrorHtml('Внутренняя ошибка сервера'));
    }
  })(req, res);
});

/**
 * POST /link-email
 * After OAuth provider returned no email, the frontend shows an email form,
 * then sends the email here with the tempToken to link it to the user account.
 */
router.post('/link-email', async (req: Request, res: Response) => {
  try {
    const { tempToken, email } = req.body;

    if (!tempToken || !email) {
      return res.status(400).json({ error: 'tempToken and email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Verify tempToken
    const decoded = jwt.verify(tempToken, JWT_SECRET) as { id: number; purpose: string };
    if (decoded.purpose !== 'link-email') {
      return res.status(400).json({ error: 'Invalid token purpose' });
    }

    // Check if email is already taken
    const existingUser = await getOne<any>('SELECT id FROM users WHERE email = ? AND id != ?', [email, decoded.id]);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Update user's email
    await runQuery('UPDATE users SET email = ? WHERE id = ?', [email, decoded.id]);

    // Update social_accounts email
    await runQuery('UPDATE social_accounts SET email = ? WHERE user_id = ?', [email, decoded.id]);

    // Fetch updated user
    const user = await getOne<any>('SELECT id, email, username, role FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate full JWT tokens
    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
    await runQuery(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, tokens.refreshToken, refreshExpiresAt.toISOString()]
    );

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatar_url: null,
        bio: null,
        is_verified: false,
        is_premium: false,
      },
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(400).json({ error: 'Invalid or expired token. Please try OAuth again.' });
    }
    console.error('Link email error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
