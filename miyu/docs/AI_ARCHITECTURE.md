# Miyu AI: Модерация треков и Рекомендации

Документ описывает целевую архитектуру и поэтапный план внедрения двух связанных подсистем:

1. **Машинная модерация** загружаемых треков с глубоким аудио-/текстовым анализом.
2. **Персональные рекомендации** для пользователей на основе извлечённых метрик и поведенческих сигналов.

Стек строго **open-source и бесплатный** (self-hosted). Без платных API.

---

## 1. Высокоуровневая архитектура

```
                        ┌──────────────────────┐
   Артист загружает →   │  Backend (Node/TS)   │
   трек (mp3/wav)       │   routes/upload      │
                        └─────────┬────────────┘
                                  │ enqueue job
                                  ▼
                        ┌──────────────────────┐
                        │  Очередь задач       │
                        │  Redis + RQ / Celery │
                        └─────────┬────────────┘
                                  │
                                  ▼
        ┌─────────────────────────────────────────────────────┐
        │          ai-service (FastAPI, Python 3.11)          │
        │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
        │  │ Audio Worker │  │ Lyrics Worker│  │ Moderation│  │
        │  │ (librosa,    │  │ (Whisper /   │  │ (rules +  │  │
        │  │  Essentia,   │  │ faster-      │  │ classifi- │  │
        │  │  PANNs,      │  │ whisper)     │  │ ers,      │  │
        │  │  Demucs opt) │  │              │  │ NSFW etc.)│  │
        │  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
        │         └─────────────────┴────────────────┘        │
        │                          │                          │
        │                ┌─────────▼──────────┐               │
        │                │ Aggregator/Scorer  │               │
        │                │ → ai_score/ai_flags│               │
        │                │ → embeddings       │               │
        │                └─────────┬──────────┘               │
        └──────────────────────────┼──────────────────────────┘
                                   │ writes
                                   ▼
                        ┌────────────────────────┐
                        │      DB (SQLite)       │
                        │  track_analysis        │
                        │  track_embeddings      │
                        │  moderation_queue      │
                        └───────────┬────────────┘
                                   │
                                   ▼
                       ┌────────────────────────┐
                       │ Recommendation Service │
                       │  (FastAPI, отдельный   │
                       │   модуль ai-service)   │
                       │  - content-based       │
                       │  - collaborative       │
                       │  - hybrid + re-rank    │
                       └───────────┬────────────┘
                                   │ /recommendations
                                   ▼
                              Frontend (React)
```

### Компоненты

- **Backend (`backend/`, Node/Express)** — приём загрузок, постановка задач, отдача рекомендаций пользователю (проксирует в `ai-service` либо читает кеш из БД).
- **Очередь** — `Redis` + `RQ` (легковеснее Celery). Задачи: `analyze_track`, `moderate_track`, `rebuild_user_profile`, `train_recsys`.
- **`ai-service` (Python, FastAPI)** — два логических модуля:
  - `analysis/` — извлечение признаков, транскрипция, модерация.
  - `recsys/` — построение профилей и выдача рекомендаций.
- **БД** — **SQLite** (постоянно). Эмбеддинги храним как `BLOB` (массив байт). ANN-индекс (faiss/hnswlib) держим в памяти ai-service — это быстрее любого SQL-поиска. SQLite справляется с миллионами записей при правильной индексации; миграция на Postgres нужна только при реальных проблемах производительности (>100k пользователей, >1M треков, конкурентная запись >100 треков/сек).
- **Хранилище аудио** — текущая папка `uploads/tracks`. Worker читает напрямую с диска (на одном хосте) или через S3-совместимое (`MinIO`) при разнесении сервисов.

---

## 2. Модерация треков

### 2.1. Цели
- Автоматически отсечь явно недопустимый контент (NSFW-обложки, hate-speech в тексте, тишина/шум, защищённый копирайтом контент — best-effort).
- Поставить трек в очередь модерации с `ai_score` и набором `ai_flags`, чтобы человек подтверждал только спорные случаи.
- Извлечь признаки, нужные рекомендациям, — за один проход.

### 2.2. Пайплайн `analyze_track(track_id, file_path)`

1. **Pre-flight**
   - Проверка целостности файла (`ffprobe`), длительности, sample rate, битрейта.
   - Если файл < 20 c или > 20 мин или повреждён → `ai_flags=["invalid_audio"]`, `status=ai_flagged`.

2. **Аудио-признаки (librosa + Essentia)**
   - BPM, key (Krumhansl), tempo stability.
   - RMS energy, spectral centroid/rolloff/flatness, ZCR.
   - MFCC (20), chroma, tonnetz — для эмбеддингов.
   - Производные: `danceability`, `energy`, `valence`, `acousticness`, `instrumentalness`, `speechiness` — на старте эвристики поверх признаков, затем заменяем на обученные модели.

3. **Tagger / Mood (PANNs или MusiCNN)**
   - Используем предобученный **PANNs CNN14** (AudioSet, 527 тегов) или **MusiCNN** (MTT/MSD, 50 тегов).
   - Лицензии: PANNs — Apache 2.0; MusiCNN — ISC. Полностью бесплатные.
   - Выход: топ-K тегов с вероятностями → `mood_tags`, `genre_tags`.
   - Эмбеддинг последнего слоя (2048d у PANNs) → `audio_embedding`.

4. **Транскрипция текста (faster-whisper)**
   - `faster-whisper` (CTranslate2, MIT) — в 4 раза быстрее openai-whisper при той же модели.
   - Модель `small` или `medium` на CPU; `large-v3` если есть GPU.
   - Результат: `lyrics_text`, `lyrics_language`, посегментные таймкоды (для караоке в будущем).

5. **Текстовая модерация**
   - Toxicity / hate: **Detoxify** (`unitary/toxic-bert`, Apache 2.0) — мульти-язычный режим.
   - Profanity / explicit: словарь + regex (быстрый pre-filter) → `is_explicit`.
   - Эмбеддинг текста: **multilingual-e5-small** (MIT) или **LaBSE** — для кросс-языкового поиска и рекомендаций по смыслу.

6. **Обложка (если есть)**
   - NSFW-классификатор: **NudeNet** (AGPL) или **OpenNSFW2** (BSD).
   - Запуск только на этапе загрузки обложки (отдельная задача `moderate_image`).

7. **Копирайт / дубликаты (best-effort, без внешних API)**
   - Аудио-fingerprint: **Chromaprint** (LGPL, есть Python-биндинги `pyacoustid`).
   - Сравнение с уже принятыми треками в БД → если совпадение > порога → `ai_flags=["possible_duplicate"]`. Это не замена ACRCloud, но базовая защита от перезагрузок.

8. **Aggregator → решение**
   - `ai_score ∈ [0,1]` — взвешенная композиция негативных сигналов (toxicity, NSFW cover, duplicate, invalid).
   - Правила:
     - `ai_score < 0.2` и нет красных флагов → `auto_approve` (если включено в настройках), иначе `pending`.
     - `0.2 ≤ ai_score < 0.7` → `pending` с приоритетом `normal/high`.
     - `ai_score ≥ 0.7` или red-flag (`hate`, `nsfw_cover`, `invalid_audio`) → `ai_flagged`, в очередь `moderation_queue` с `priority='high'`.
   - Все промежуточные сигналы пишутся в `ai_flags` (JSON-строка).

### 2.3. Изменения в БД

Расширение `track_analysis` (миграция):

```sql
ALTER TABLE track_analysis ADD COLUMN acousticness REAL;
ALTER TABLE track_analysis ADD COLUMN instrumentalness REAL;
ALTER TABLE track_analysis ADD COLUMN speechiness REAL;
ALTER TABLE track_analysis ADD COLUMN loudness REAL;
ALTER TABLE track_analysis ADD COLUMN genre_tags TEXT;          -- JSON array of {tag, prob}
ALTER TABLE track_analysis ADD COLUMN audio_embedding BLOB;     -- float32 vector
ALTER TABLE track_analysis ADD COLUMN text_embedding BLOB;      -- float32 vector
ALTER TABLE track_analysis ADD COLUMN fingerprint TEXT;         -- chromaprint
ALTER TABLE track_analysis ADD COLUMN analysis_version TEXT;    -- для ре-анализа
```

Новая таблица для дубликатов/похожих:

```sql
CREATE TABLE track_similarity (
    track_id INTEGER NOT NULL,
    similar_track_id INTEGER NOT NULL,
    score REAL NOT NULL,
    method TEXT NOT NULL,    -- 'audio_emb' | 'fingerprint' | 'text_emb'
    PRIMARY KEY (track_id, similar_track_id, method)
);
```

### 2.4. API ai-service (расширение)

- `POST /analyze` — уже есть, дополнить ответ новыми полями.
- `POST /moderate/cover` — `{track_id, image_path}` → NSFW score.
- `POST /reanalyze` — пересчитать признаки при обновлении модели (`analysis_version`).
- `GET  /health`, `GET /metrics` (Prometheus-формат).

---

## 3. Рекомендации

### 3.1. Сигналы пользователя
Из существующих таблиц:
- `track_plays(play_duration, completed)` — implicit feedback. Skip (< 30 c или < 30%) — негатив.
- `likes`, `album_likes`, `artist_follows` — сильный позитив.
- `playlist_tracks` — кураторский позитив.
- `now_playing`, `user_stats` — сезонность/время суток.

### 3.2. Профиль пользователя `user_taste_profile`

Новая таблица (пересчитывается фоновым job каждые N часов или инкрементально):

```sql
CREATE TABLE user_taste_profile (
    user_id INTEGER PRIMARY KEY,
    taste_embedding BLOB,        -- центроид взвешенных эмбеддингов треков
    top_genres TEXT,             -- JSON: [{tag, weight}]
    top_moods TEXT,              -- JSON
    bpm_mean REAL, bpm_std REAL,
    energy_mean REAL, valence_mean REAL, danceability_mean REAL,
    diversity REAL,              -- разброс embedding'ов (для exploration)
    updated_at TEXT
);
```

**Вес взаимодействия (зафиксировано):**
```
w(track) = 3.0 * like
         + 2.0 * in_user_playlist
         + 1.5 * follow_artist
         + 1.0 * completed_play_count
         + 0.3 * partial_play_count
         + 1.0 * video_completed_count        # клипы привязаны к трекам — учитываем как плей
         + 0.3 * video_partial_count
         - 1.5 * explicit_dislike              # из recsys_feedback
         - 0.8 * early_skip_count              # только <10s И трек был незнаком пользователю
```
с экспоненциальным затуханием по времени (`half_life = 30 дней`).

`taste_embedding = Σ w_i * audio_embedding_i / Σ w_i`.

**В `taste_embedding` НЕ идут:**
- `tickets` / `donations` — это сигнал любви к **артисту**, а не к конкретному треку. Идёт в re-ranker как boost любимых артистов (см. 3.3).
- Контекст времени суток / дня недели — не используем (избыточная сложность для текущего масштаба).
- Достижения — слишком зашумлены.

### 3.3. Алгоритмы

Гибридная схема — три кандидата-генератора + ре-ранжирование:

1. **Content-based (CB)**
   - kNN в пространстве `audio_embedding` (cosine) к `taste_embedding`.
   - Реализация: `faiss-cpu` (MIT) или `hnswlib` (Apache 2.0). Индекс держим в памяти ai-service (загружается при старте, обновляется по расписанию). Это быстрее любого SQL-поиска, включая pgvector.

2. **Collaborative Filtering (CF)**
   - **Implicit ALS** (`implicit` lib, MIT) на матрице `user × track` с весами из плейев/лайков.
   - Альтернатива/дополнение: **LightFM** (Apache 2.0) — гибрид user/item features.
   - Холодный старт пользователя → CB по первым лайкам/онбордингу.

3. **Popularity / Trending** — fallback и для бустинга:
   - Формула Hacker News / Wilson lower bound по `track_plays` за окно 7/30 дней.

4. **Re-ranker**
   - Фильтры: убрать уже прослушанные сегодня, треки заблокированных артистов, контент `is_explicit` если выключено в настройках, `status != 'approved'`.
   - Diversity (MMR): штраф за похожесть на уже выбранные кандидаты (cosine на эмбеддингах).
   - Бустинги: новые релизы любимых артистов, активные `promotions`, друзья сейчас слушают (`now_playing`).
   - Финальный скор: `α*CB + β*CF + γ*pop + δ*friends - λ*similarity_penalty`.
   - Коэффициенты — конфиг в `ai-service/recsys/config.yaml`, тюнятся оффлайн.

### 3.4. Сценарии выдачи

- **«Моя волна» / Daily Mix** — N=50 треков, обновляется раз в сутки + дополняется онлайн по сигналам сессии.
- **«Похожее на трек X»** — чистый CB (kNN по embedding), без учёта профиля.
- **«Похожие артисты»** — агрегация эмбеддингов треков артиста → kNN по артистам.
- **«Новое для вас»** — CB по `taste_embedding`, фильтр `created_at > now-30d`, исключение знакомого.
- **Радио по плейлисту/треку** — seed-эмбеддинг + MMR.

### 3.5. API recsys

- `GET /recsys/feed?user_id=&limit=` → главная лента.
- `GET /recsys/similar/track/{id}?limit=`.
- `GET /recsys/similar/artist/{id}?limit=`.
- `GET /recsys/radio?seed_track=&limit=`.
- `POST /recsys/feedback` — explicit dislike / «не нравится» (важный сигнал).
- `POST /recsys/profile/rebuild?user_id=` — административный.

### 3.6. Оффлайн-оценка
- Метрики: `Recall@K`, `NDCG@K`, `MAP@K`, `Coverage`, `Diversity`.
- Стратегия: hold-out последних N плейев пользователя; weekly job логирует метрики в `metrics_log` таблицу.

---

## 4. Стек (всё OSS/бесплатно)

| Назначение | Библиотека | Лицензия |
|---|---|---|
| Аудио-DSP | `librosa` | ISC |
| Доп. аудио-признаки | `essentia` | AGPL (для self-host ок) |
| Audio tagging / embedding | `panns_inference` (PANNs CNN14) | Apache 2.0 |
| Source separation (опц.) | `demucs` | MIT |
| Транскрипция | `faster-whisper` | MIT |
| Текст-эмбеддинги | `sentence-transformers` (`multilingual-e5-small`) | MIT |
| Toxicity | `detoxify` | Apache 2.0 |
| NSFW image | `opennsfw2` или `nudenet` | BSD / AGPL |
| Fingerprint | `pyacoustid` + `chromaprint` | LGPL |
| ANN-индекс | `faiss-cpu` / `hnswlib` | MIT / Apache 2.0 |
| CF | `implicit`, `lightfm` | MIT / Apache 2.0 |
| Очередь | `redis` + `rq` | BSD / MIT |
| БД | SQLite (встроенная) | Public Domain |
| Мониторинг | `prometheus_client`, Grafana | Apache 2.0 |

GPU не обязателен. На CPU realtime ~ 0.3–0.8× длительности трека для всего пайплайна (Whisper small + PANNs).

---

## 5. План реализации (по фазам)

### Фаза 0 — фундамент ✅
- [x] Миграция БД: новые поля в `track_analysis`, таблицы `track_similarity`, `user_taste_profile`.
- [x] `requirements.txt` в `ai-service` с реальными зависимостями + закрепить версии.
- [x] `docker-compose.yml`: `ai-service`, `redis`, прокидка `uploads/`.
- [x] Backend: `routes/ai.ts` (точнее `routes/recsys.ts`) — прокси к `ai-service`.

### Фаза 1 — модерация MVP ✅
- [x] Реальные библиотеки в `ai-service/analysis/*` (PANNs, faster-whisper, detoxify).
- [x] Worker (`rq`): `analyze_track_job` пишет в `track_analysis` + `moderation_queue`.
- [x] Хук в backend на `POST /tracks/upload` — enqueue.
- [x] Админ-страница модерации.
- [x] Юнит-тесты на агрегатор правил.

### Фаза 2 — эмбеддинги и similar ✅
- [x] `audio_embedding` (PANNs penultimate) и `text_embedding` (e5).
- [x] `recsys/index.py` — построение hnsw-индекса по `approved` трекам.
- [x] `GET /recsys/similar/track/{id}` + кеш в Redis.
- [x] Frontend: блок «Похожие треки».

### Фаза 3 — профиль и Daily Mix ✅
- [x] Job `rebuild_user_profile_job` (`app/workers/tasks.py`) — on-demand через cooldown 30 с.
- [x] Content-based feed: `app/recsys/profile.py` + `app/recsys/feed.py`.
- [x] Эндпоинт `GET /recsys/feed` + Redis-кеш per-user (TTL 1 ч), versioning по `updated_at`.
- [x] Re-ranker: MMR diversity (λ=0.7) + max-2-per-artist + `listened-today` / `dislike` фильтры (`app/recsys/reranker.py`).
- [x] Frontend: `pages/WavePage.tsx` («Моя волна»), feedback-кнопки 👎 / 🚫 артиста.
- [x] Тесты: 20 для profile/decay/центроид + 13 для popularity/MMR (33 контроля чистой логики).

### Фаза 4 — коллаборативная фильтрация (lite реализована)
- [x] **Lite item-item CF** на co-occurrence (`app/recsys/itemcf.py`):
  - сигнал: `likes` + добавления в свой плейлист;
  - `sim(i, j) = co(i, j) / sqrt(c(i) * c(j))`, top-50 соседей;
  - pickle-снапшот `data/itemcf_index.pkl`, in-memory cache TTL 6 ч;
  - job `rebuild_itemcf_job` + offline `scripts/build_itemcf.py`.
- [x] **Гибридный re-ranker** в `feed.py`: `0.6·CB + 0.4·CF + 0.05·popularity` после min-max нормализации каждого источника.
- [x] **Оффлайн-оценка** (`scripts/eval_recsys.py`): time-based split, Recall@K / NDCG@K / Coverage, сравнение `popularity` vs `itemcf` (CF-индекс строится только на history → без утечки).
- [x] Тесты: 13 на co-occurrence/recommend + 3 на min-max нормализацию (16 новых, всего 57 ai-service-тестов).
- [ ] Полноценный ALS (`implicit.als`) — отложен до накопления данных; вернёмся, когда метрики lite-CF выйдут на плато.
- [ ] Дашборд метрик (markdown-отчёт уже есть; UI-страница админки — потом).

### Фаза 5 — продакшн-готовность ✅
- [x] Prometheus метрики (app/metrics.py — 20+ метрик)
- [x] Эндпоинт /metrics с реальными данными (app/main.py)
- [x] Метрики воркеров: throughput, latency по типам задач
- [x] Метрики модерации: ai_score distribution, decisions, flags
- [x] Метрики рекомендаций: feed latency, cache hit rate, index sizes
- [x] Grafana dashboard (grafana/dashboard.json — 12 панелей)
- [x] Docker-compose с Prometheus + Grafana
- [ ] Ре-анализ при смене analysis_version (бэкграунд)
- [ ] A/B-тесты весов re-ranker'а
- [ ] (Опционально) Миграция на Postgres — только при реальных проблемах производительности (>100k пользователей, конкурентная запись >100 треков/сек). SQLite достаточно для MVP и раннего роста.

---

## 6. Зафиксированные решения и открытые вопросы

**Зафиксировано:**

- **Гибридный feed (Фаза 4-lite).** Веса `α=0.6` (CB) + `β=0.4` (CF) + `γ=0.05` (popularity-boost) после min-max нормализации каждого источника. `α/β/γ` хранятся как константы в `feed.py` (`HYBRID_W_CB / HYBRID_W_CF / HYBRID_W_POP`) и подбираются по результатам `scripts/eval_recsys.py`. Полноценный ALS — отдельная Фаза 4-full, когда lite-метрики выйдут на плато.


- **Окружение: CPU-only.** Используем `faster-whisper small` (int8) для транскрипции и PANNs CNN14 на CPU (ONNX-вариант, если есть). На длинных треках Whisper — самая тяжёлая стадия; запускаем её последней и в отдельной задаче, чтобы не блокировать модерацию аудио.

- **Auto-approve включён.** Правила:
  - `ai_score < 0.2` **и** нет ни одного red-flag (`hate`, `nsfw_cover`, `invalid_audio`, `possible_duplicate`) → `tracks.status = 'approved'` автоматически, в `moderation_queue` запись не создаётся (либо создаётся со `status='approved'` для аудита).
  - `0.2 ≤ ai_score < 0.7` → `pending`, очередь модерации, приоритет по `ai_score`.
  - `ai_score ≥ 0.7` или red-flag → `ai_flagged`, `priority='high'`.
  - Артисты без `is_verified` получают штраф +0.1 к `ai_score` (мягкий gate для новых аккаунтов).
  - **Лимит auto-approve на артиста: ОТКЛЮЧЁН** (`auto_approve_daily_limit = 0`). Анти-абьюз не используем — полагаемся только на `ai_score` и red-flags. Защита от заливки чужого контента — на этапе fingerprint-сравнения с нашей БД (см. ниже).

- **Копирайт-стратегия: только сравнение с собственной БД.**
  - `Chromaprint` (`pyacoustid` + системный `fpcalc`) считает fingerprint каждого загруженного трека.
  - Сравнение с уже принятыми треками в `track_analysis.fingerprint` и через cosine на `audio_embedding`. Совпадение → `ai_flags=["possible_duplicate"]`, red-flag → ручная проверка.
  - Внешние сервисы (AcoustID/MusicBrainz/ACRCloud) **не используем** — ни в Фазе 0–2, ни позже. Защита от первой заливки чужого мейнстрим-контента — реактивно через DMCA-процесс (вне scope ai-service).

- **Сигналы для `user_taste_profile`:**
  - **Учитываются** (формула — см. 3.2): `likes`, `album_likes`, `playlist_tracks`, `artist_follows`, `track_plays`, `video_views` (с тем же весом, что и `track_plays` — клипы привязаны к существующим трекам), `recsys_feedback`.
  - **НЕ учитываются** в эмбеддинге трека:
    - `tickets`, `donations` — идут только в re-ranker как boost любимых артистов (см. 3.3).
    - Контекст времени (утро/вечер, будни/выходные) — не используем, переусложнение для текущего масштаба.
    - Достижения — слишком зашумлены.
  - **Skip-правило:** отрицательный вес (`-0.8`) только если skip произошёл в **первые 10 секунд** **И** трек ранее не встречался пользователю (незнаком). Иначе вес 0 — обычные «надоевшие» скипы не штрафуем.

- **Онбординг: НЕ используем.**
  - Новый пользователь сразу попадает в основной флоу. До накопления ≥20 значимых событий (лайки + completed plays) feed формируется через **popularity / trending** (Hacker News-формула по `track_plays` за 7/30 дней).
  - Как только `interactions_count >= 20` в `user_taste_profile` — переключаемся на content-based feed по `taste_embedding`.
  - Никаких дополнительных таблиц/UI экранов выбора жанров/артистов на регистрации.

**Открытых вопросов нет.** Все решения по AI-подсистеме зафиксированы.

---

## 7. Структура каталога `ai-service` (целевая)

```
ai-service/
  app/
    main.py                 # FastAPI app, роутеры
    config.py
    deps.py
    analysis/
      __init__.py
      audio_features.py     # librosa + essentia
      tagging.py            # PANNs / MusiCNN
      transcription.py      # faster-whisper
      text_moderation.py    # detoxify, profanity
      image_moderation.py   # opennsfw2
      fingerprint.py        # chromaprint
      aggregator.py         # → ai_score, ai_flags
      pipeline.py           # analyze_track()
    recsys/
      profile.py            # build/update user_taste_profile
      candidates.py         # CB / CF / popularity
      reranker.py           # MMR, фильтры, бустинги
      index.py              # faiss/hnsw обёртки
      train_als.py          # ночной job
      api.py                # /recsys/* роутер
    workers/
      queue.py              # rq setup
      tasks.py              # analyze_track, rebuild_profile, …
    db/
      models.py             # SQLAlchemy/raw
      migrations/
  scripts/
    build_index.py
    eval_recsys.py
  tests/
  Dockerfile
  requirements.txt
  pyproject.toml
```

---

Готов после согласования начать с **Фазы 0** (миграции БД + docker-compose + структура `ai-service`).
