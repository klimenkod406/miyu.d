-- Miyu Database Schema for SQLite
-- Стриминговый сервис музыки

-- ==================== USERS ====================
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'artist', 'moderator', 'admin')),
    avatar_url TEXT,
    bio TEXT,
    is_verified INTEGER DEFAULT 0,
    is_premium INTEGER DEFAULT 0,
    premium_expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE artist_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    stage_name TEXT,
    real_name TEXT,
    genre TEXT,
    country TEXT,
    website TEXT,
    instagram TEXT,
    twitter TEXT,
    total_plays INTEGER DEFAULT 0,
    total_earnings REAL DEFAULT 0,
    verified_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==================== AUTH ====================
CREATE TABLE refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==================== ALBUMS ====================
CREATE TABLE albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    release_year INTEGER,
    cover_url TEXT,
    description TEXT,
    genre TEXT,
    type TEXT DEFAULT 'album' CHECK(type IN ('album', 'single', 'ep')),
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==================== TRACKS ====================
CREATE TABLE tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL,
    album_id INTEGER,
    title TEXT NOT NULL,
    duration INTEGER NOT NULL,
    track_number INTEGER,
    file_path TEXT NOT NULL,
    file_path_hd TEXT,
    cover_url TEXT,
    genre TEXT,
    bpm INTEGER,
    key TEXT,
    lyrics TEXT,
    is_explicit INTEGER DEFAULT 0,
    is_premium INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

CREATE TABLE track_plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    playlist_id INTEGER,        -- источник: из какого плейлиста воспроизведено
    play_duration INTEGER NOT NULL,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

-- ==================== VIDEOS ====================
CREATE TABLE videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL,
    album_id INTEGER,           -- альбом, к которому относится клип
    track_id INTEGER,          -- трек, к которому относится клип (если клип к треку)
    title TEXT NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    thumbnail_url TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    views_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- ==================== VIDEO VIEWS ====================
CREATE TABLE video_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    playlist_id INTEGER,       -- источник: из какого плейлиста
    view_duration INTEGER NOT NULL,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

-- ==================== PLAYLISTS ====================
CREATE TABLE playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    is_public INTEGER DEFAULT 1,
    is_system INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    added_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    UNIQUE(playlist_id, track_id)
);

CREATE TABLE playlist_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    playlist_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    UNIQUE(user_id, playlist_id)
);

-- ==================== SOCIAL ====================
CREATE TABLE friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'blocked')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, friend_id)
);

CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('like', 'follow', 'comment', 'share', 'achievement', 'concert', 'friend_request', 'share_stats')),
    from_user_id INTEGER,
    target_type TEXT,
    target_id INTEGER,
    message TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE now_playing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    track_id INTEGER NOT NULL,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    UNIQUE(user_id, track_id)
);

CREATE TABLE album_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    album_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    UNIQUE(user_id, album_id)
);

CREATE TABLE artist_follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    artist_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, artist_id)
);

-- ==================== STATISTICS & ANALYSIS ====================
CREATE TABLE user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    total_minutes INTEGER DEFAULT 0,
    tracks_played INTEGER DEFAULT 0,
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE track_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER UNIQUE NOT NULL,
    mood_tags TEXT, -- Тэги настроения, например: "energetic, happy, electronic"
    bpm REAL,
    key TEXT,
    danceability REAL, -- Танцевальность от 0.0 до 1.0
    energy REAL, -- Энергичность от 0.0 до 1.0
    valence REAL, -- Позитивность/насыщенность от 0.0 до 1.0
    lyrics_text TEXT, -- Распознанный текст песни
    lyrics_language TEXT, -- Язык текста
    analysis_summary TEXT, -- Краткое резюме анализа
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    requirement_type TEXT NOT NULL,
    requirement_value INTEGER NOT NULL,
    rarity TEXT DEFAULT 'common' CHECK(rarity IN ('common', 'rare', 'epic', 'legendary')),
    is_secret INTEGER DEFAULT 0
);

CREATE TABLE user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id INTEGER NOT NULL,
    unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
    UNIQUE(user_id, achievement_id)
);

CREATE TABLE achievement_showcase (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id INTEGER NOT NULL,
    position INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
    UNIQUE(user_id, achievement_id)
);

-- ==================== MODERATION ====================
CREATE TABLE moderation_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL CHECK(content_type IN ('track', 'album', 'cover', 'lyrics')),
    content_id INTEGER NOT NULL,
    submitted_by INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'ai_flagged')),
    ai_score REAL,
    ai_flags TEXT,
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high')),
    reviewed_by INTEGER,
    review_comment TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT,
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL,
    reported_user_id INTEGER,
    content_type TEXT,
    content_id INTEGER,
    reason TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==================== CONCERTS & TICKETS ====================
CREATE TABLE concerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    venue TEXT,
    city TEXT,
    country TEXT,
    address TEXT,
    event_date TEXT NOT NULL,
    event_time TEXT,
    cover_url TEXT,
    total_seats INTEGER,
    available_seats INTEGER,
    status TEXT DEFAULT 'pending',
    is_in_banner INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE ticket_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    concert_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    sold INTEGER DEFAULT 0,
    description TEXT,
    FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE
);

CREATE TABLE tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_type_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    seat_row TEXT,
    seat_number TEXT,
    qr_code TEXT,
    status TEXT DEFAULT 'valid' CHECK(status IN ('valid', 'used', 'cancelled')),
    purchased_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==================== PASSWORD RESET ====================
CREATE TABLE password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- ==================== PAYMENTS & SUBSCRIPTIONS ====================
CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan TEXT NOT NULL CHECK(plan IN ('free', 'pro', 'ultra')),
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'cancelled', 'expired')),
    started_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    auto_renew INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('subscription', 'ticket', 'donation', 'promotion', 'refund')),
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'RUB',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_method TEXT,
    external_id TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    artist_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==================== PROMOTION ====================
CREATE TABLE promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    budget REAL NOT NULL,
    spent REAL DEFAULT 0,
    target_audience TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- ==================== INDEXES ====================
CREATE INDEX idx_tracks_artist ON tracks(artist_id);
CREATE INDEX idx_tracks_album ON tracks(album_id);
CREATE INDEX idx_tracks_status ON tracks(status);
CREATE INDEX idx_playlists_user ON playlists(user_id);
CREATE INDEX idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);
CREATE INDEX idx_track_plays_track ON track_plays(track_id);
CREATE INDEX idx_track_plays_user ON track_plays(user_id);
CREATE INDEX idx_user_stats_user ON user_stats(user_id);
CREATE INDEX idx_track_analysis_track ON track_analysis(track_id);
CREATE INDEX idx_moderation_status ON moderation_queue(status);
CREATE INDEX idx_moderation_priority ON moderation_queue(priority);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_tickets_user ON tickets(user_id);
CREATE INDEX idx_concerts_artist ON concerts(artist_id);

-- ==================== VIEW FOR RECOMMENDATIONS ====================
CREATE VIEW user_top_tracks AS
SELECT
    tp.track_id,
    tp.user_id,
    COUNT(*) as play_count,
    SUM(tp.play_duration) as total_duration
FROM track_plays tp
GROUP BY tp.track_id, tp.user_id;

-- ==================== SEED DATA ====================
-- Default achievements (public)
INSERT INTO achievements (code, title, description, icon, requirement_type, requirement_value, is_secret) VALUES
    ('first_track', 'Новичок', 'Прослушайте первый трек', '🎵', 'tracks_played', 1, 0),
    ('first_playlist', 'Первый плейлист', 'Создайте первый плейлист', '📋', 'playlists_created', 1, 0),
    ('playlist_2', 'Два плейлиста', 'Создайте 2 плейлиста', '📋', 'playlists_created', 2, 0),
    ('playlist_3', 'Три плейлиста', 'Создайте 3 плейлиста', '📋', 'playlists_created', 3, 0),
    ('meloman', 'Меломан', 'Прослушайте 1000 минут музыки', '🎧', 'total_minutes', 1000, 0),
    ('curator', 'Куратор', 'Создайте 5 плейлистов', '📋', 'playlists_created', 5, 0),
    ('socialite', 'Социальный', 'Добавить 10 друзей', '👥', 'friends_added', 10, 0),
    ('explorer', 'Первооткрыватель', 'Прослушайте 20 новых артистов', '🔍', 'new_artists', 20, 0),
    ('first_like', 'Первый лайк', 'Поставьте первый лайк треку', '❤️', 'likes', 1, 0),
    ('premiumMember', 'Премиум', 'Купите подписку Premium', '👑', 'premium', 1, 0),
    ('playlist_10', 'Библиотекарь', 'Создайте 10 плейлистов', '📚', 'playlists_created', 10, 0),
    ('listener_100h', 'Суперслушатель', 'Прослушайте 100 часов музыки', '⏰', 'total_minutes', 6000, 0),
    ('friends_50', 'Душа компании', 'Заведите 50 друзей', '🤝', 'friends_added', 50, 0),
    ('artists_50', 'Музыкальный эксперт', 'Прослушайте 50 разных артистов', '🎤', 'new_artists', 50, 0),
    ('hours_500', 'Легенда стриминга', 'Прослушайте 500 часов музыки', '🏆', 'total_minutes', 30000, 0),
    -- Legendary achievements (secret - revealed only when unlocked)
    ('legendary_first', 'Первооткрыватель легенд', 'Вы первым разблокировали легендарное достижение', '🌟', 'tracks_played', 1, 1),
    ('legendary_mega', 'Мега-меломан', 'Прослушайте 10000 минут музыки', '💎', 'total_minutes', 10000, 1),
    ('legendary_social', 'Магнит друзей', 'Заводите 100 друзей', '💫', 'friends_added', 100, 1),
    ('legendary_curator', 'Мастер коллекций', 'Создайте 25 плейлистов', '🎨', 'playlists_created', 25, 1);
