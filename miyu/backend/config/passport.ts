import passport from 'passport';
import { getOne, runQuery } from '../db';

// Yandex Strategy (only if configured)
if (process.env.YANDEX_CLIENT_ID) {
  passport.use('yandex', new (require('passport-yandex').Strategy as any)({
    clientID: process.env.YANDEX_CLIENT_ID,
    clientSecret: process.env.YANDEX_CLIENT_SECRET!,
    callbackURL: process.env.YANDEX_CALLBACK_URL,
  }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      const email = profile.emails?.[0]?.value;
      const user = await findOrCreateUser('yandex', profile.id, email, profile);
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
} else {
  console.warn('Yandex OAuth not configured - YANDEX_CLIENT_ID is empty');
}

// VKontakte Strategy (only if configured)
if (process.env.VK_CLIENT_ID) {
  passport.use('vkontakte', new (require('passport-vkontakte').Strategy as any)({
    clientID: process.env.VK_CLIENT_ID,
    clientSecret: process.env.VK_CLIENT_SECRET!,
    callbackURL: process.env.VK_CALLBACK_URL,
    scope: ['email'],
    profileFields: ['email', 'photo_200', 'first_name', 'last_name'],
    lang: 'ru',
    apiVersion: '5.131',
  }, async (accessToken: string, refreshToken: string, params: any, profile: any, done: any) => {
    try {
      // VK returns email in params.email, NOT in profile.emails
      const email = params.email || profile.emails?.[0]?.value;
      const user = await findOrCreateUser('vkontakte', profile.id, email, profile);
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
} else {
  console.warn('VK OAuth not configured - VK_CLIENT_ID is empty');
}

// GitHub Strategy (only if configured)
if (process.env.GITHUB_CLIENT_ID) {
  passport.use('github', new (require('passport-github2').Strategy as any)({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackURL: process.env.GITHUB_CALLBACK_URL,
    scope: ['user:email'],
  }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      const email = profile.emails?.[0]?.value || null;
      const user = await findOrCreateUser('github', profile.id, email, profile);
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
} else {
  console.warn('GitHub OAuth not configured - GITHUB_CLIENT_ID is empty');
}

async function findOrCreateUser(provider: string, providerId: string, email: string | undefined, profile: any) {
  // 1. Check social_accounts binding exists
  const existing = await getOne<any>(
    `SELECT u.id, u.email, u.username, u.role FROM social_accounts sa
     JOIN users u ON u.id = sa.user_id
     WHERE sa.provider = ? AND sa.provider_id = ?`,
    [provider, providerId]
  );
  if (existing) {
    await runQuery(
      "UPDATE social_accounts SET last_login_at = datetime('now') WHERE provider = ? AND provider_id = ?",
      [provider, providerId]
    );
    return existing;
  }

  // 1b. If email exists, check if a user with this email already exists
  if (email) {
    const userByEmail = await getOne<any>(
      'SELECT id, email, username, role FROM users WHERE email = ?',
      [email]
    );
    if (userByEmail) {
      // Link social account to existing user
      await runQuery(
        "INSERT INTO social_accounts (user_id, provider, provider_id, email) VALUES (?, ?, ?, ?)",
        [userByEmail.id, provider, providerId, email]
      );
      await runQuery(
        "UPDATE social_accounts SET last_login_at = datetime('now') WHERE provider = ? AND provider_id = ?",
        [provider, providerId]
      );
      return userByEmail;
    }
  }

  // 2. Create new user (password_hash is NULL for OAuth users)
  const displayName = profile.displayName || '';
  const username = profile.username ||
    displayName.replace(/\s+/g, '_') ||
    `${provider}_${providerId.substring(0, 8)}`;
  const avatarUrl = profile.photos?.[0]?.value || profile._json?.avatar_url || null;

  const result = await runQuery(
    'INSERT INTO users (email, username, password_hash, role, avatar_url) VALUES (?, ?, NULL, ?, ?)',
    [email || null, username, 'user', avatarUrl]
  );
  const userId = result.lastID;

  // Create system playlist "Liked"
  await runQuery(
    "INSERT INTO playlists (user_id, title, description, is_public, is_system) VALUES (?, ?, ?, ?, ?)",
    [userId, 'Liked', 'Лайкнутые треки', 0, 1]
  );

  // Save social_account binding
  await runQuery(
    "INSERT INTO social_accounts (user_id, provider, provider_id, email) VALUES (?, ?, ?, ?)",
    [userId, provider, providerId, email || null]
  );

  return { id: userId, email, username, role: 'user' };
}

export default passport;
