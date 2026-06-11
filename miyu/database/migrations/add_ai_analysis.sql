-- Migration: AI analysis & recommendations foundation (Фаза 0)
-- Применяется автоматически из backend/db/migrate.ts.
-- Здесь оставлено как справочный артефакт.

-- 1) Расширение track_analysis
ALTER TABLE track_analysis ADD COLUMN acousticness REAL;
ALTER TABLE track_analysis ADD COLUMN instrumentalness REAL;
ALTER TABLE track_analysis ADD COLUMN speechiness REAL;
ALTER TABLE track_analysis ADD COLUMN loudness REAL;
ALTER TABLE track_analysis ADD COLUMN genre_tags TEXT;          -- JSON: [{"tag":"rock","prob":0.82}, ...]
ALTER TABLE track_analysis ADD COLUMN audio_embedding BLOB;     -- float32[N], little-endian
ALTER TABLE track_analysis ADD COLUMN text_embedding BLOB;      -- float32[N]
ALTER TABLE track_analysis ADD COLUMN fingerprint TEXT;         -- chromaprint
ALTER TABLE track_analysis ADD COLUMN analysis_version TEXT;    -- e.g. "v1"
ALTER TABLE track_analysis ADD COLUMN ai_score REAL;            -- зеркалит moderation_queue.ai_score
ALTER TABLE track_analysis ADD COLUMN ai_flags TEXT;            -- JSON array
ALTER TABLE track_analysis ADD COLUMN updated_at TEXT;

-- 2) Похожесть треков (для /similar и анти-дубликатов)
CREATE TABLE IF NOT EXISTS track_similarity (
    track_id INTEGER NOT NULL,
    similar_track_id INTEGER NOT NULL,
    score REAL NOT NULL,
    method TEXT NOT NULL CHECK(method IN ('audio_emb', 'fingerprint', 'text_emb')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (track_id, similar_track_id, method),
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (similar_track_id) REFERENCES tracks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_track_similarity_track ON track_similarity(track_id, method, score DESC);

-- 3) Профиль вкуса пользователя
CREATE TABLE IF NOT EXISTS user_taste_profile (
    user_id INTEGER PRIMARY KEY,
    taste_embedding BLOB,
    top_genres TEXT,          -- JSON: [{"tag":"rock","weight":0.42}, ...]
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
);

-- 4) Явная обратная связь (dislike/hide artist) для recsys
CREATE TABLE IF NOT EXISTS recsys_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    target_type TEXT NOT NULL CHECK(target_type IN ('track', 'artist', 'genre')),
    target_id INTEGER,
    target_value TEXT,        -- для жанра/тега
    signal TEXT NOT NULL CHECK(signal IN ('dislike', 'hide', 'less_like_this')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_recsys_feedback_user ON recsys_feedback(user_id, created_at DESC);

-- 5) Журнал AI-задач (для отладки/мониторинга)
CREATE TABLE IF NOT EXISTS ai_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL,    -- 'analyze_track' | 'rebuild_profile' | 'reanalyze' | 'moderate_cover'
    target_id INTEGER,
    status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','done','failed')),
    error TEXT,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_target ON ai_jobs(job_type, target_id);
