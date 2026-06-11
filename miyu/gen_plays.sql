-- Massively boost play counts to look alive
-- We'll use a Python-generated approach for bulk inserts

-- Helper: Generate many plays for a specific track
-- Use repeated inserts with different random users and dates

-- === MEGA HITS (top 5 tracks: 2000-5000 plays each) ===

-- Track 26 (mot-namek-na-nas) - THE #1 hit
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 26,
    (abs(random()) % 250) + 1,
    168 * (75 + abs(random()) % 26) / 100,
    CASE WHEN abs(random()) % 100 < 68 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (
    WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 200)
    SELECT x FROM cnt
);

-- Track 24 (MiYu Artist - 1)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 24,
    (abs(random()) % 250) + 1,
    168 * (75 + abs(random()) % 26) / 100,
    CASE WHEN abs(random()) % 100 < 65 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (
    WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 160)
    SELECT x FROM cnt
);

-- Track 29 (Повело - ANNA ASTI)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 29,
    (abs(random()) % 250) + 1,
    173 * (75 + abs(random()) % 26) / 100,
    CASE WHEN abs(random()) % 100 < 62 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (
    WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 130)
    SELECT x FROM cnt
);

-- Track 30 (Царица - ANNA ASTI)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 30,
    (abs(random()) % 250) + 1,
    215 * (75 + abs(random()) % 26) / 100,
    CASE WHEN abs(random()) % 100 < 60 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (
    WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 110)
    SELECT x FROM cnt
);

-- Track 27 (Yamakasi - Andy Panda)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 27,
    (abs(random()) % 250) + 1,
    264 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 55 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (
    WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 85)
    SELECT x FROM cnt
);

-- === STRONG TRACKS (500-1500 plays each) ===

-- Track 32 (Как Тебя Забыть)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 32, (abs(random()) % 250) + 1, 202 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 58 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 55) SELECT x FROM cnt);

-- Track 31 (А Если Это Любовь)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 31, (abs(random()) % 250) + 1, 241 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 56 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 48) SELECT x FROM cnt);

-- Track 41 (Се Ля Ви - MACAN)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 41, (abs(random()) % 250) + 1, 164 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 55 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 42) SELECT x FROM cnt);

-- Track 111 (Дорадура - Дора)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 111, (abs(random()) % 250) + 1, 134 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 52 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 38) SELECT x FROM cnt);

-- Track 72 (Grenade - Bruno Mars)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 72, (abs(random()) % 250) + 1, 223 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 60 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 35) SELECT x FROM cnt);

-- Track 123 (Где Ты - Три дня дождя)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 123, (abs(random()) % 250) + 1, 143 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 54 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 32) SELECT x FROM cnt);

-- Track 103 (Blinding Lights - The Weeknd)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 103, (abs(random()) % 250) + 1, 202 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 62 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 30) SELECT x FROM cnt);

-- Track 50 (Мама 2006 - Баста)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 50, (abs(random()) % 250) + 1, 237 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 58 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 28) SELECT x FROM cnt);

-- Track 78 (Плачу На Техно)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 78, (abs(random()) % 250) + 1, 160 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 25) SELECT x FROM cnt);

-- Track 116 (Мне Пох - Моргенштерн)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 116, (abs(random()) % 250) + 1, 159 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 25) SELECT x FROM cnt);

-- Track 33 (Прятки - HammAli & Navai)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 33, (abs(random()) % 250) + 1, 193 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 55 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 22) SELECT x FROM cnt);

-- Track 34 (Пустите Меня На Танцпол)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 34, (abs(random()) % 250) + 1, 256 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 52 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 20) SELECT x FROM cnt);

-- Track 79 (А Тебе - DOROFEEVA)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 79, (abs(random()) % 250) + 1, 161 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 18) SELECT x FROM cnt);

-- Track 64 (Капкан)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 64, (abs(random()) % 250) + 1, 229 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 55 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 18) SELECT x FROM cnt);

-- Track 52 (Сансара - Баста)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 52, (abs(random()) % 250) + 1, 363 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 45 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 18) SELECT x FROM cnt);

-- Track 55 (Миллион Алых Роз)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 55, (abs(random()) % 250) + 1, 191 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 58 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 15) SELECT x FROM cnt);

-- Track 105 (The Hills - The Weeknd)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 105, (abs(random()) % 250) + 1, 242 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 52 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 15) SELECT x FROM cnt);

-- Track 46 (Beverly Hills)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 46, (abs(random()) % 250) + 1, 220 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 56 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 12) SELECT x FROM cnt);

-- Track 68 (Это Любовь)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 68, (abs(random()) % 250) + 1, 281 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 12) SELECT x FROM cnt);

-- Track 51 (Моя Игра - Баста)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 51, (abs(random()) % 250) + 1, 269 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 60 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 12) SELECT x FROM cnt);

-- Track 28 (По Барам)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 28, (abs(random()) % 250) + 1, 238 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 52 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 10) SELECT x FROM cnt);

-- Track 61 (Лилии)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 61, (abs(random()) % 250) + 1, 199 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 54 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 10) SELECT x FROM cnt);

-- Track 62 (Сопрано)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 62, (abs(random()) % 250) + 1, 210 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 52 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 10) SELECT x FROM cnt);

-- Track 63 (Август Это Ты)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 63, (abs(random()) % 250) + 1, 165 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 10) SELECT x FROM cnt);

-- Track 39 (Кино)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 39, (abs(random()) % 250) + 1, 184 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 55 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 10) SELECT x FROM cnt);

-- Track 40 (Останься Образом)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 40, (abs(random()) % 250) + 1, 217 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 52 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 10) SELECT x FROM cnt);

-- Track 42 (Там Ревели Горы)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 42, (abs(random()) % 250) + 1, 177 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 10) SELECT x FROM cnt);

-- Track 114 (Не Исправлюсь - Дора)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 114, (abs(random()) % 250) + 1, 214 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 10) SELECT x FROM cnt);

-- Track 83 (New Rules - Dua Lipa)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 83, (abs(random()) % 250) + 1, 212 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 55 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 8) SELECT x FROM cnt);

-- Track 73 (Talking To The Moon - Bruno Mars)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 73, (abs(random()) % 250) + 1, 216 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 58 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 8) SELECT x FROM cnt);

-- Track 90 (Искал-Нашёл)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 90, (abs(random()) % 250) + 1, 247 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 52 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 8) SELECT x FROM cnt);

-- Track 65 (Соло)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 65, (abs(random()) % 250) + 1, 185 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 8) SELECT x FROM cnt);

-- Track 93 (Экспонат)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 93, (abs(random()) % 250) + 1, 99 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 45 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 8) SELECT x FROM cnt);

-- Track 43 (Marlboro)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 43, (abs(random()) % 250) + 1, 243 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 8) SELECT x FROM cnt);

-- Track 119 (Намёк на нас - Мот)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 119, (abs(random()) % 250) + 1, 168 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 55 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 8) SELECT x FROM cnt);

-- Track 120 (Портрет - Мот)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 120, (abs(random()) % 250) + 1, 186 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 52 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 8) SELECT x FROM cnt);

-- Track 121 (Шадэ Index-1 - Мот)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 121, (abs(random()) % 250) + 1, 168 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 8) SELECT x FROM cnt);

-- Track 124 (Отпускай - Три дня дождя)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 124, (abs(random()) % 250) + 1, 207 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 52 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 6) SELECT x FROM cnt);

-- Track 87 (Bad Liar - Imagine Dragons)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 87, (abs(random()) % 250) + 1, 261 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 55 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 6) SELECT x FROM cnt);

-- Remaining tracks get small bumps (3-8 extra plays each)
INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 35, (abs(random()) % 250) + 1, 160 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 6) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 36, (abs(random()) % 250) + 1, 161 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 6) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 37, (abs(random()) % 250) + 1, 148 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 5) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 38, (abs(random()) % 250) + 1, 177 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 5) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 44, (abs(random()) % 250) + 1, 243 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 5) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 45, (abs(random()) % 250) + 1, 164 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 5) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 48, (abs(random()) % 250) + 1, 188 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 52 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 5) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 49, (abs(random()) % 250) + 1, 223 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 5) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 53, (abs(random()) % 250) + 1, 197 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 5) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 54, (abs(random()) % 250) + 1, 225 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 52 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 5) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 56, (abs(random()) % 250) + 1, 236 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 5) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 57, (abs(random()) % 250) + 1, 192 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 4) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 58, (abs(random()) % 250) + 1, 194 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 4) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 59, (abs(random()) % 250) + 1, 243 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 52 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 4) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 60, (abs(random()) % 250) + 1, 202 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 4) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 66, (abs(random()) % 250) + 1, 228 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 4) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 67, (abs(random()) % 250) + 1, 206 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 4) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 106, (abs(random()) % 250) + 1, 167 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 4) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 107, (abs(random()) % 250) + 1, 217 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 4) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 108, (abs(random()) % 250) + 1, 198 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 4) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 94, (abs(random()) % 250) + 1, 192 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 4) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 95, (abs(random()) % 250) + 1, 233 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 52 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 4) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 109, (abs(random()) % 250) + 1, 184 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 112, (abs(random()) % 250) + 1, 162 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 113, (abs(random()) % 250) + 1, 222 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 115, (abs(random()) % 250) + 1, 205 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 117, (abs(random()) % 250) + 1, 163 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 118, (abs(random()) % 250) + 1, 161 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 96, (abs(random()) % 250) + 1, 214 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 97, (abs(random()) % 250) + 1, 213 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 98, (abs(random()) % 250) + 1, 220 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 99, (abs(random()) % 250) + 1, 197 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 100, (abs(random()) % 250) + 1, 271 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 101, (abs(random()) % 250) + 1, 267 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 102, (abs(random()) % 250) + 1, 184 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 104, (abs(random()) % 250) + 1, 228 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 88, (abs(random()) % 250) + 1, 189 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 89, (abs(random()) % 250) + 1, 188 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 91, (abs(random()) % 250) + 1, 186 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 92, (abs(random()) % 250) + 1, 252 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 122, (abs(random()) % 250) + 1, 169 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 25, (abs(random()) % 250) + 1, 168 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 82, (abs(random()) % 250) + 1, 179 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 84, (abs(random()) % 250) + 1, 194 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 85, (abs(random()) % 250) + 1, 220 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 86, (abs(random()) % 250) + 1, 205 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 69, (abs(random()) % 250) + 1, 250 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 70, (abs(random()) % 250) + 1, 320 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 71, (abs(random()) % 250) + 1, 227 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 74, (abs(random()) % 250) + 1, 264 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 75, (abs(random()) % 250) + 1, 295 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 76, (abs(random()) % 250) + 1, 273 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 50 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 110, (abs(random()) % 250) + 1, 124 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 3) SELECT x FROM cnt);

INSERT INTO track_plays (track_id, user_id, play_duration, completed, created_at)
SELECT 122, (abs(random()) % 250) + 1, 169 * (70 + abs(random()) % 31) / 100,
    CASE WHEN abs(random()) % 100 < 48 THEN 1 ELSE 0 END,
    datetime('2025-01-01', '+' || (abs(random()) % 510) || ' days', '+' || (abs(random()) % 24) || ' hours', '+' || (abs(random()) % 60) || ' minutes')
FROM (WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 2) SELECT x FROM cnt);
