# AGENTS.md

## Project Structure

```
miyu/                    # Monorepo - fully functional music streaming service
├── frontend/             # React 18 + Vite + TypeScript + Tailwind (port 5173)
├── backend/              # Express 5 + TypeScript + SQLite (port 3001)
├── ai-service/           # Python + FastAPI + ML models (port 8001)
├── database/             # SQLite database + migrations + Docker configs
├── deploy/               # Nginx configuration for production
└── scripts/              # Development utilities (dev-all.cjs)
```

## Commands

### Start all services (recommended):
```bash
cd miyu
npm run dev
```
This starts frontend, backend, ai-service, ai-worker, and Redis (via Docker) simultaneously.

### Or start individually:

**Frontend:**
```bash
cd frontend
npm run dev      # Start Vite dev server (port 5173)
npm run build    # tsc -b && vite build
npm run lint     # eslint .
```

**Backend:**
```bash
cd backend
npm run dev      # Start Express server with ts-node (port 3001)
npm run build    # tsc
```

**AI-service:**
```bash
cd ai-service
.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8001
```

**Redis (required for AI-service):**
```bash
cd database
docker compose up -d redis
```

### Benchmark transcription:
```bash
cd ai-service

# Run benchmark for a specific track with a config:
.venv\Scripts\python.exe tests/test_benchmark.py --track 34 --config baseline

# Run all configs for a track (compares WER/CER/Recall across all):
.venv\Scripts\python.exe tests/test_benchmark.py --track 34 --all-configs

# Specify audio path and language:
.venv\Scripts\python.exe tests/test_benchmark.py --track 77 --config music_polish --audio "path/to/audio.mp3" --lang ru

# Run via pytest:
.venv\Scripts\python.exe -m pytest tests/test_benchmark.py -v --tb=long
```

Benchmark reports WER (Word Error Rate), CER (Character Error Rate), recall, precision, F1, and segment coverage. Results saved to `tests/benchmark_results/`.

## Architecture

- **Entry**: `frontend/src/main.tsx` → `App.tsx` → React Router
- **Pages**: `src/pages/` (40+ pages for all user roles)
- **Components**: `src/components/`
- **API**: `src/api/`, **Hooks**: `src/hooks/`, **Types**: `src/types/`

### Backend API Structure

Backend provides REST API with 27+ route modules:
- `auth` — registration, login, JWT tokens
- `user` — profile and settings
- `admin` — administrative functions
- `artist`, `artist-albums`, `artist-videos` — artist dashboard
- `album`, `track`, `videos` — music and video content
- `moderation` — content moderation
- `likes`, `playlists`, `history` — user library
- `friendships`, `following`, `notifications` — social features
- `concerts`, `transactions` — concerts, tickets, payments
- `achievements` — gamification system
- `search`, `support`, `ai`, `recsys`, `home` — discovery and recommendations

### Guest Access

Guests (unauthenticated users) can only access the home page (`/`). All other routes require authentication. The player UI is hidden for guests, but audio playback works for demo purposes.

### AI-Service Pipelines

```
=== TRANSCRIPTION PIPELINE ===

Audio file --> librosa (load, resample to 22kHz)
         --> faster-whisper (transcribe with config params)
              |-- VAD (Voice Activity Detection) -- filters silence
              |-- Decoding: beam_size, temperature, hotwords
              |-- Post-filters: prompt leak, hallucination, repeat, low confidence
              '-- Soft VAD fallback -- re-transcribes low-coverage regions
         --> phonetic_corrections (200+ regex patterns fix common errors)
         --> segment merging & dedup
         --> lyrics stored in DB

=== MODERATION PIPELINE ===

Text (lyrics + manual) --> check_all() across 9 categories
   |-- sex (1.0)      |-- drugs (1.0)     |-- racism (1.0)*
   |-- fascism (1.0)* |-- profanity (1.0) |-- violence (0.9)
   |-- nationalism (0.8) |-- alcohol (0.6) |-- smoking (0.6)
   '-- *red_flag categories -- trigger minimum mmr=0.85

--> WHITELIST check (exclude false positives)
--> MMR Scoring (weighted density + category minimums)
   |-- Any hit --> is_18plus = True
   |-- Profanity --> mmr >= 0.15
   |-- Racism/Fascism --> mmr >= 0.85
   |-- Sex --> mmr >= 0.5
   |-- Drugs --> mmr >= 0.4
   '-- Violence --> mmr >= 0.3
--> decision: approve / pending / flag

=== KARAOKE FLOW ===

Track playback --> DB (retrieve segments with timestamps)
              --> AI API (get word-level alignment)
              --> Frontend (segment display with current word highlight)
              --> Player timeline slider updates based on segment boundaries
```

### AI-Service: Config System

Transcription behavior is controlled by `TranscriptionConfig` in `app/analysis/transcription_params.py`. Pre-set configs (FACTORY dict):

| Config | Description | Key params |
|--------|-------------|------------|
| `baseline` | Production default | VAD on, beam=8, temp=[0-0.6] |
| `vad_softer` | Lower VAD threshold (0.3) | More speech captured |
| `vad_minimal` | VAD nearly off | beam=10, captures almost everything |
| `no_vad_full_beam` | VAD off, beam=12 | Max capture, lenient decoding |
| `low_noise_tolerant` | For dense music/beats | VAD threshold=0.25 |
| `high_recall` | Max recall for edge cases | VAD off, beam=10 |
| `music_optimized` | OPTIMAL for music | VAD off, beam=10, hotwords |
| `music_precise` | PRECISION for hard tracks | VAD off, beam=12, high temp |
| `music_rap_focused` | For rap/hip-hop | beam=10, repeat filter off |
| `music_conditional` | Better text coherence | condition_on_prev_text=True |
| `music_vad_light` | Very light VAD for noisy | threshold=0.05 |
| `music_polish` | POLISH beam=15, patience=2 | Highest quality |
| `music_hybrid` | Mixed-language tracks | hotwords RU+EN, beam=12 |
| `music_hybrid_ru` | Russian+English mix | log_prob_threshold=-1.5 |

### AI-Service: Phonetic Corrections

`app/analysis/phonetic_corrections.py` contains 200+ regex patterns that fix common Whisper transcription errors for Russian pop music:
- **Track-specific corrections**: HammAli & Navai (танцпол), JONY (Комета), Баста (Сансара), Дора (Втюрилась), Zivert (Beverly Hills), МакSим, Cream Soda
- **Universal patterns**: ё->е normalization, whitespace/punctuation cleanup, common misspellings
- **Segment-level**: Applies corrections to both segment text and individual word timestamps
- **Pipeline integration**: Applied after Whisper transcription, before DB storage

### AI-Service: Censorship/Moderation

`app/analysis/profanity_dict.py` -- 700+ lines of regex patterns across 9 categories with whitelist:
- Each category has a weight (1.0 red-flag, 0.9 severe, 0.8 moderate, 0.6 mild)
- Whitelist excludes false positives
- `check_all()` returns structured hits with positions, categories, weighted score

`app/analysis/text_moderation.py` -- MMR scoring system:
- Any trigger word --> `is_18plus = True`
- `mmr_score` (0..1) = weighted density with category-specific floors
- Backward-compatible wrapper `ExplicitAnalysis` for old Detoxify-based code

### AI-Service: Benchmark System

`tests/test_benchmark.py` compares Whisper transcription against ground truth (manually verified lyrics):
- **9 test tracks** in `tests/ground_truth/`: track_34 (HammAli & Navai), track_36 (JONY), track_46 (Zivert), track_48 (hybrid RU/EN), track_50 (mother theme), track_52 (Баста), track_59 (МакSим), track_77 (Cream Soda), track_110 (Дора)
- **Metrics**: WER (word error rate), CER (character error rate), recall, precision, F1, coverage
- **All-configs mode**: Runs all 14 configs against a track and prints comparison table
- **Results** saved as JSON to `tests/benchmark_results/`

## Key Conventions

- Tailwind CSS for styling (dark theme with glassmorphism)
- React Router for routing with `GuestHomeOnlyGate` protection
- JWT + refresh tokens auth pattern (access 7d, refresh 30d)
- Real payment system integration (ЮKassa)
- AI-service integration via HTTP fire-and-forget pattern

## Development Notes

- AI-service has Python tests in `ai-service/tests/`
- **Transcription configs**: 14 pre-set configs in `app/analysis/transcription_params.py` for A/B testing
- **Phonetic corrections**: 200+ regex patterns in `app/analysis/phonetic_corrections.py` for Russian pop lyrics
- **Censorship system**: 9 categories (sex, drugs, racism, fascism, profanity, violence, alcohol, smoking, nationalism) with whitelist and MMR scoring
- **Benchmarks**: `tests/test_benchmark.py` with 9 ground-truth tracks in `tests/ground_truth/`
- **Karaoke**: Word-level segment timestamps from Whisper displayed in frontend timeline slider
- Backend uses SQLite with manual SQL/TypeScript migrations
- Frontend proxies `/api/*` requests to backend (port 3001)
- Docker required for Redis (AI-service queue)
- Run `npm run build` before deployment (Vite)
- Production deployment uses Docker Compose (`docker-compose.prod.yml`)