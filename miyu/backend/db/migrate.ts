
import { db, getOne, runQuery } from './index';
import fs from 'fs';
import path from 'path';

async function applyMigrations() {
    console.log('Applying migrations...');

    // Check if album_likes table exists
    const albumLikesExists = await getOne(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='album_likes'
    `).catch(() => null);

    if (!albumLikesExists) {
        console.log('Creating album_likes table...');
        await runQuery(`
            CREATE TABLE album_likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                album_id INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
                UNIQUE(user_id, album_id)
            )
        `);
        console.log('✓ album_likes table created');
    }

    // Check if artist_follows table exists
    const artistFollowsExists = await getOne(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='artist_follows'
    `).catch(() => null);

    if (!artistFollowsExists) {
        console.log('Creating artist_follows table...');
        await runQuery(`
            CREATE TABLE artist_follows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                artist_id INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, artist_id)
            )
        `);
        console.log('✓ artist_follows table created');
    }

    const artistApplicationsExists = await getOne(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='artist_applications'
    `).catch(() => null);

    if (!artistApplicationsExists) {
        console.log('Creating artist_applications table...');
        await runQuery(`
            CREATE TABLE artist_applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                message TEXT,
                links TEXT,
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
                reviewed_by INTEGER,
                reviewed_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✓ artist_applications table created');
    }

    const supportTicketsExists = await getOne(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='support_tickets'
    `).catch(() => null);

    if (!supportTicketsExists) {
        console.log('Creating support_tickets table...');
        await runQuery(`
            CREATE TABLE support_tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                issue_area TEXT NOT NULL,
                description TEXT NOT NULL,
                attachments TEXT,
                status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
                admin_response TEXT,
                reviewed_by INTEGER,
                reviewed_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✓ support_tickets table created');
    }

    const typeColumnExists = await getOne<{ count: number }>(`SELECT COUNT(*) as count FROM pragma_table_info('artist_applications') WHERE name='type'`).catch(() => null);
    if (!typeColumnExists || typeColumnExists.count === 0) {
        await runQuery(`ALTER TABLE artist_applications ADD COLUMN type TEXT DEFAULT 'create'`);
    }

    const reasonColumnExists = await getOne<{ count: number }>(`SELECT COUNT(*) as count FROM pragma_table_info('artist_applications') WHERE name='reason'`).catch(() => null);
    if (!reasonColumnExists || reasonColumnExists.count === 0) {
        await runQuery(`ALTER TABLE artist_applications ADD COLUMN reason TEXT`);
    }

    // Check if played_at column exists in track_plays
    const playedAtExists = await getOne<{ count: number }>(`
        SELECT COUNT(*) as count FROM pragma_table_info('track_plays') WHERE name='played_at'
    `).catch(() => null);

    if (!playedAtExists || playedAtExists.count === 0) {
        console.log('Adding played_at column to track_plays...');
        await runQuery(`
            ALTER TABLE track_plays ADD COLUMN played_at TEXT
        `);
        // Update existing rows to use created_at value
        await runQuery(`
            UPDATE track_plays SET played_at = created_at WHERE played_at IS NULL
        `);
        console.log('✓ played_at column added');
    }

    // Check if color palette columns exist in users table
    const paletteMode = await getOne<{ count: number }>(`
        SELECT COUNT(*) as count FROM pragma_table_info('users') WHERE name='palette_mode'
    `).catch(() => null);

    if (!paletteMode || paletteMode.count === 0) {
        console.log('Adding color palette columns to users...');
        await runQuery(`
            ALTER TABLE users ADD COLUMN palette_mode TEXT DEFAULT 'auto'
        `);
        await runQuery(`
            ALTER TABLE users ADD COLUMN palette_primary TEXT
        `);
        await runQuery(`
            ALTER TABLE users ADD COLUMN palette_secondary TEXT
        `);
        await runQuery(`
            ALTER TABLE users ADD COLUMN palette_tertiary TEXT
        `);
        console.log('✓ Color palette columns added');
    }

    // ==================== AI: Phase 0 ====================
    // Расширение track_analysis новыми полями
    const aiColumns: { name: string; type: string }[] = [
        { name: 'acousticness', type: 'REAL' },
        { name: 'instrumentalness', type: 'REAL' },
        { name: 'speechiness', type: 'REAL' },
        { name: 'loudness', type: 'REAL' },
        { name: 'genre_tags', type: 'TEXT' },
        { name: 'audio_embedding', type: 'BLOB' },
        { name: 'text_embedding', type: 'BLOB' },
        { name: 'fingerprint', type: 'TEXT' },
        { name: 'analysis_version', type: 'TEXT' },
        { name: 'ai_score', type: 'REAL' },
        { name: 'ai_flags', type: 'TEXT' },
        { name: 'updated_at', type: 'TEXT' },
        { name: 'segments_json', type: 'TEXT' }, // JSON array of {start,end,text} от Whisper
    ];
    for (const col of aiColumns) {
        const exists = await getOne<{ count: number }>(
            `SELECT COUNT(*) as count FROM pragma_table_info('track_analysis') WHERE name=?`,
            [col.name],
        ).catch(() => null);
        if (!exists || exists.count === 0) {
            console.log(`Adding ${col.name} to track_analysis...`);
            await runQuery(`ALTER TABLE track_analysis ADD COLUMN ${col.name} ${col.type}`);
        }
    }

    // Похожесть треков
    await runQuery(`
        CREATE TABLE IF NOT EXISTS track_similarity (
            track_id INTEGER NOT NULL,
            similar_track_id INTEGER NOT NULL,
            score REAL NOT NULL,
            method TEXT NOT NULL CHECK(method IN ('audio_emb', 'fingerprint', 'text_emb')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (track_id, similar_track_id, method),
            FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
            FOREIGN KEY (similar_track_id) REFERENCES tracks(id) ON DELETE CASCADE
        )
    `);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_track_similarity_track ON track_similarity(track_id, method, score DESC)`);

    // Профиль вкуса пользователя
    await runQuery(`
        CREATE TABLE IF NOT EXISTS user_taste_profile (
            user_id INTEGER PRIMARY KEY,
            taste_embedding BLOB,
            top_genres TEXT,
            top_moods TEXT,
            bpm_mean REAL,
            bpm_std REAL,
            energy_mean REAL,
            valence_mean REAL,
            danceability_mean REAL,
            diversity REAL,
            interactions_count INTEGER DEFAULT 0,
            profile_version TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Явная обратная связь recsys
    await runQuery(`
        CREATE TABLE IF NOT EXISTS recsys_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            target_type TEXT NOT NULL CHECK(target_type IN ('track', 'artist', 'genre')),
            target_id INTEGER,
            target_value TEXT,
            signal TEXT NOT NULL CHECK(signal IN ('dislike', 'hide', 'less_like_this')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_recsys_feedback_user ON recsys_feedback(user_id, created_at DESC)`);

    await runQuery(`
        CREATE TABLE IF NOT EXISTS personalized_home_cache (
            user_id INTEGER PRIMARY KEY,
            generated_for TEXT,
            featured_artists_json TEXT,
            daily_playlist_id INTEGER,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (daily_playlist_id) REFERENCES playlists(id) ON DELETE SET NULL
        )
    `);

    await runQuery(`
        CREATE TABLE IF NOT EXISTS personalized_home_playlists (
            user_id INTEGER NOT NULL,
            playlist_id INTEGER NOT NULL UNIQUE,
            kind TEXT NOT NULL CHECK(kind IN ('mood', 'daily')),
            slot_key TEXT NOT NULL,
            generated_for TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, kind, slot_key),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
        )
    `);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_personalized_home_playlists_user ON personalized_home_playlists(user_id, kind)`);

    await runQuery(`
        CREATE TABLE IF NOT EXISTS playlist_likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            playlist_id INTEGER NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            UNIQUE(user_id, playlist_id)
        )
    `);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_playlist_likes_user ON playlist_likes(user_id, created_at DESC)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_playlist_likes_playlist ON playlist_likes(playlist_id)`);

    // Журнал AI-задач
    await runQuery(`
        CREATE TABLE IF NOT EXISTS ai_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_type TEXT NOT NULL,
            target_id INTEGER,
            status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','done','failed')),
            error TEXT,
            started_at TEXT,
            finished_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status, created_at DESC)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_ai_jobs_target ON ai_jobs(job_type, target_id)`);

    // user_taste_profile.interactions_count — счётчик значимых событий (Фаза 3).
    // Используется для переключения popularity → content-based feed (порог 20).
    const interactionsCountCol = await getOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM pragma_table_info('user_taste_profile') WHERE name='interactions_count'`
    ).catch(() => null);
    if (!interactionsCountCol || interactionsCountCol.count === 0) {
        console.log('Adding interactions_count to user_taste_profile...');
        await runQuery(`ALTER TABLE user_taste_profile ADD COLUMN interactions_count INTEGER DEFAULT 0`);
        console.log('✓ interactions_count column added');
    }

    // Расширяем notifications.type CHECK, чтобы добавить 'track_moderated'.
    // SQLite не позволяет менять CHECK — пересоздаём таблицу при необходимости.
    const needNotifMigration = await getOne<{ sql: string }>(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='notifications'`
    ).catch(() => null);
    if (needNotifMigration?.sql && (!needNotifMigration.sql.includes('track_moderated') || !needNotifMigration.sql.includes('support_resolved'))) {
        console.log('Recreating notifications table with extended type CHECK...');
        await runQuery(`
            CREATE TABLE notifications_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL CHECK(type IN (
                    'like', 'follow', 'comment', 'share', 'achievement',
                    'concert', 'friend_request', 'share_stats', 'track_moderated',
                    'artist_page_deleted', 'support_resolved'
                )),
                from_user_id INTEGER,
                target_type TEXT,
                target_id INTEGER,
                message TEXT,
                read INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        await runQuery(`
            INSERT INTO notifications_new (id, user_id, type, from_user_id, target_type, target_id, message, read, created_at)
            SELECT id, user_id, type, from_user_id, target_type, target_id, message, read, created_at FROM notifications
        `);
        await runQuery(`DROP TABLE notifications`);
        await runQuery(`ALTER TABLE notifications_new RENAME TO notifications`);
        console.log('✓ notifications.type CHECK extended with track_moderated');
    }

    console.log('Migrations applied successfully.');
}

async function clearAchievements() {
    console.log('Clearing achievements...');
    await runQuery('DELETE FROM user_achievements');
    await runQuery('DELETE FROM achievement_showcase');
    await runQuery('DELETE FROM achievements');
    console.log('Achievements cleared.');
}

async function seedData() {
    console.log('Checking if seed data is needed...');

    const firstConcert = await getOne('SELECT id FROM concerts LIMIT 1').catch(() => null);
    if (firstConcert) {
        console.log('Seed data already exists.');
        return;
    }

    const artist = await getOne<{ id: number }>("SELECT id FROM users WHERE email = 'artist@miyu.ru'").catch(() => null);
    if (!artist) {
        console.log('Default artist not found, skipping concert seeding.');
        return;
    }
    
    console.log('Seeding concert data...');
    try {
        // Concert 1
        const concert1 = await runQuery(`
            INSERT INTO concerts (artist_id, title, description, venue, city, country, address, event_date, event_time, cover_url, total_seats, available_seats, status, is_in_banner)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            artist.id, 'Starlight Overdrive Tour', 'Живое выступление с новым альбомом и лучшими хитами. Незабываемое световое шоу и энергетика!',
            'Adrenaline Stadium', 'Москва', 'Россия', 'Ленинградский просп., 80, корп. 17',
            '2026-07-15', '20:00', null, 8000, 8000, 'available', 1
        ]);
        const concert1Id = concert1.lastID;
        await runQuery(`INSERT INTO ticket_types (concert_id, name, price, quantity) VALUES (?, ?, ?, ?)`, [concert1Id, 'Танцпол', 2500, 6000]);
        await runQuery(`INSERT INTO ticket_types (concert_id, name, price, quantity) VALUES (?, ?, ?, ?)`, [concert1Id, 'VIP', 8000, 2000]);

        // Concert 2
        const concert2 = await runQuery(`
            INSERT INTO concerts (artist_id, title, description, venue, city, country, address, event_date, event_time, cover_url, total_seats, available_seats, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            artist.id, 'Acoustic Evening', 'Ламповый акустический вечер в уютной атмосфере. Только живой звук и близкий контакт с артистом.',
            'Клуб 16 Тонн', 'Москва', 'Россия', 'ул. Пресненский Вал, 6, стр. 1',
            '2026-08-22', '19:30', null, 300, 300, 'available'
        ]);
        const concert2Id = concert2.lastID;
        await runQuery(`INSERT INTO ticket_types (concert_id, name, price, quantity) VALUES (?, ?, ?, ?)`, [concert2Id, 'Входной', 4000, 300]);

        console.log('✓ Concert data seeded successfully.');

    } catch (error) {
        console.error('Failed to seed concert data:', error);
    }
}

export async function migrate() {
  const runMigration = () => new Promise<void>((resolve, reject) => {
    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema, (err) => {
      if (err) {
        console.error('Migration error:', err.message);
        reject(err);
      } else {
        console.log('Database schema executed successfully');
        resolve();
      }
    });
  });

  const checkColumn = (tableName: string, columnName: string) => new Promise<boolean>((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, columns: any[]) => {
      if (err) return reject(err);
      const columnExists = columns.some(c => c.name === columnName);
      resolve(columnExists);
    });
  });

  const addColumn = (tableName: string, columnName: string, columnDef: string) => new Promise<void>((resolve, reject) => {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`, (err) => {
      if (err) return reject(err);
      console.log(`Column ${columnName} added to ${tableName}`);
      resolve();
    });
  });

  return new Promise<void>((resolve, reject) => {
    db.get('SELECT name FROM sqlite_master WHERE type="table" AND name="users"', async (err, row) => {
      if (err) return reject(err);
      
      if (!row) {
        console.log('Database not initialized. Running full migration...');
        try {
          await runMigration();
          await applyMigrations(); // Apply additional migrations
          await seedData(); // Seed data after initial migration
          return resolve();
        } catch (execErr) {
          return reject(execErr);
        }
      }
      
      console.log('Database already initialized. Checking for schema updates...');
      try {
        const hasBannerColumn = await checkColumn('concerts', 'is_in_banner');
        if (!hasBannerColumn) {
          await addColumn('concerts', 'is_in_banner', 'INTEGER DEFAULT 0');
        }
        
        const hasSecretAchievementColumn = await checkColumn('achievements', 'is_secret');
        if (!hasSecretAchievementColumn) {
          await addColumn('achievements', 'is_secret', 'INTEGER DEFAULT 0');
        }

        const hasRarityColumn = await checkColumn('achievements', 'rarity');
        if (!hasRarityColumn) {
          await addColumn('achievements', 'rarity', "TEXT DEFAULT 'common'");
        }

        const hasProfilePublicColumn = await checkColumn('users', 'is_profile_public');
        if (!hasProfilePublicColumn) {
          await addColumn('users', 'is_profile_public', 'INTEGER DEFAULT 1');
        }

        const hasShowHistoryColumn = await checkColumn('users', 'show_history');
        if (!hasShowHistoryColumn) {
          await addColumn('users', 'show_history', 'INTEGER DEFAULT 1');
        }

        const hasShowLikesColumn = await checkColumn('users', 'show_likes');
        if (!hasShowLikesColumn) {
          await addColumn('users', 'show_likes', 'INTEGER DEFAULT 1');
        }

        const hasShowAchievementsColumn = await checkColumn('users', 'show_achievements');
        if (!hasShowAchievementsColumn) {
          await addColumn('users', 'show_achievements', 'INTEGER DEFAULT 1');
        }

        const hasShowFavoriteArtistsColumn = await checkColumn('users', 'show_favorite_artists');
        if (!hasShowFavoriteArtistsColumn) {
          await addColumn('users', 'show_favorite_artists', 'INTEGER DEFAULT 1');
        }

        const hasShowFavoriteAlbumsColumn = await checkColumn('users', 'show_favorite_albums');
        if (!hasShowFavoriteAlbumsColumn) {
          await addColumn('users', 'show_favorite_albums', 'INTEGER DEFAULT 1');
        }

        const hasShowPlaylistsColumn = await checkColumn('users', 'show_playlists');
        if (!hasShowPlaylistsColumn) {
          await addColumn('users', 'show_playlists', 'INTEGER DEFAULT 1');
        }

        const hasShowFavoriteTracksColumn = await checkColumn('users', 'show_favorite_tracks');
        if (!hasShowFavoriteTracksColumn) {
          await addColumn('users', 'show_favorite_tracks', 'INTEGER DEFAULT 1');
        }

        const hasShowcaseTable = await getOne("SELECT name FROM sqlite_master WHERE type='table' AND name='achievement_showcase'");
        if (!hasShowcaseTable) {
          await runQuery(`
            CREATE TABLE achievement_showcase (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              achievement_id INTEGER NOT NULL,
              position INTEGER DEFAULT 0,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
              UNIQUE(user_id, achievement_id)
            )
          `);
        }

        const hasNotificationsTable = await getOne("SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'");
        if (!hasNotificationsTable) {
          console.log('Creating notifications table...');
          await runQuery(`
            CREATE TABLE notifications (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              type TEXT NOT NULL,
              from_user_id INTEGER,
              target_type TEXT,
              target_id INTEGER,
              message TEXT,
              read INTEGER DEFAULT 0,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL
            )
          `);
        }

        const hasFriendshipsTable = await getOne("SELECT name FROM sqlite_master WHERE type='table' AND name='friendships'");
        if (!hasFriendshipsTable) {
          console.log('Creating friendships table...');
          await runQuery(`
            CREATE TABLE friendships (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              friend_id INTEGER NOT NULL,
              status TEXT DEFAULT 'pending',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
              UNIQUE(user_id, friend_id)
            )
          `);
        }

        const hasFollowsTable = await getOne("SELECT name FROM sqlite_master WHERE type='table' AND name='follows'");
        if (!hasFollowsTable) {
          console.log('Creating follows table...');
          await runQuery(`
            CREATE TABLE follows (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              follower_id INTEGER NOT NULL,
              following_id INTEGER NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
              UNIQUE(follower_id, following_id)
            )
          `);
        }

        const hasNotifyLikes = await checkColumn('users', 'notify_likes');
        if (!hasNotifyLikes) {
          await addColumn('users', 'notify_likes', 'INTEGER DEFAULT 1');
        }

        const hasNotifyFollows = await checkColumn('users', 'notify_follows');
        if (!hasNotifyFollows) {
          await addColumn('users', 'notify_follows', 'INTEGER DEFAULT 1');
        }

        const hasNotifyFriendRequests = await checkColumn('users', 'notify_friend_requests');
        if (!hasNotifyFriendRequests) {
          await addColumn('users', 'notify_friend_requests', 'INTEGER DEFAULT 1');
        }

        const hasNotifyConcerts = await checkColumn('users', 'notify_concerts');
        if (!hasNotifyConcerts) {
          await addColumn('users', 'notify_concerts', 'INTEGER DEFAULT 1');
        }

        const hasLastSeen = await checkColumn('users', 'last_seen');
        if (!hasLastSeen) {
          await addColumn('users', 'last_seen', 'TEXT');
        }

        const hasShowOnlineStatus = await checkColumn('users', 'show_online_status');
        if (!hasShowOnlineStatus) {
          await addColumn('users', 'show_online_status', 'INTEGER DEFAULT 1');
        }

        const hasShowListeningStatus = await checkColumn('users', 'show_listening_status');
        if (!hasShowListeningStatus) {
          await addColumn('users', 'show_listening_status', 'INTEGER DEFAULT 1');
        }

        const hasCurrentTrackId = await checkColumn('users', 'current_track_id');
        if (!hasCurrentTrackId) {
          await addColumn('users', 'current_track_id', 'INTEGER');
        }

        const hasCurrentContextType = await checkColumn('users', 'current_context_type');
        if (!hasCurrentContextType) {
          await addColumn('users', 'current_context_type', 'TEXT');
        }

        const hasCurrentContextId = await checkColumn('users', 'current_context_id');
        if (!hasCurrentContextId) {
          await addColumn('users', 'current_context_id', 'INTEGER');
        }

        const hasCurrentContextTitle = await checkColumn('users', 'current_context_title');
        if (!hasCurrentContextTitle) {
          await addColumn('users', 'current_context_title', 'TEXT');
        }

        const hasListeningUpdatedAt = await checkColumn('users', 'listening_updated_at');
        if (!hasListeningUpdatedAt) {
          await addColumn('users', 'listening_updated_at', 'TEXT');
        }

        const hasPinnedInSidebar = await checkColumn('friendships', 'is_pinned_in_sidebar');
        if (!hasPinnedInSidebar) {
          await addColumn('friendships', 'is_pinned_in_sidebar', 'INTEGER DEFAULT 0');
        }

        const hasHiddenInSidebar = await checkColumn('friendships', 'is_hidden_in_sidebar');
        if (!hasHiddenInSidebar) {
          await addColumn('friendships', 'is_hidden_in_sidebar', 'INTEGER DEFAULT 0');
        }

        const hasVenuePlanId = await checkColumn('concerts', 'venue_plan_id');
        if (!hasVenuePlanId) {
          await addColumn('concerts', 'venue_plan_id', 'TEXT');
        }

        const hasZoneId = await checkColumn('ticket_types', 'zone_id');
        if (!hasZoneId) {
          await addColumn('ticket_types', 'zone_id', 'TEXT');
        }

        // One-time cleanup: nullify cover_urls that point to a path that no longer exists on disk.
        // Affected only the demo seed paths /uploads/concert_covers/concertN.jpg.
        await runQuery(
          "UPDATE concerts SET cover_url = NULL WHERE cover_url LIKE '/uploads/concert_covers/%'"
        );

        // concert_artists: many-to-many for additional/co-performing artists on a concert
        await runQuery(`
          CREATE TABLE IF NOT EXISTS concert_artists (
            concert_id INTEGER NOT NULL,
            artist_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (concert_id, artist_id),
            FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
            FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);

        await applyMigrations(); // Apply additional migrations
        await seedData(); // Also seed data after incremental migration if needed

        console.log('Schema updates checked.');
        resolve();
      } catch (updateErr) {
        console.error('Schema update error:', updateErr);
        reject(updateErr);
      }
    });
  });
}

export async function closeDb() {
  return new Promise<void>((resolve) => {
    db.close(() => resolve());
  });
}
