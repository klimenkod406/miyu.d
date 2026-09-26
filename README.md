# Miyu (Мийу) — Music Streaming Platform

A self-hosted music streaming service with a web UI, REST API, and an
integrated AI service for track analysis, transcription and recommendations.

This repository is a monorepo that bundles frontend, backend, AI-service,
database migrations and production deployment configuration.

## Architecture

```
┌──────────────────────────────┐
│  Browser                     │
└──────────────┬───────────────┘
               │ /api/*
┌──────────────▼───────────────┐
│  Backend (Express 5 + TS)    │   Port 3001
│  SQLite storage, JWT auth    │
└──────────────┬───────────────┘
               │ HTTP (fire-and-forget)
┌──────────────▼───────────────┐
│  AI-service (FastAPI / Py)   │   Port 8001
│  Track analysis, recsys      │
└──────────────┬───────────────┘
               │
          Redis (task queue)
```

| Component     | Tech                                            | Port |
|---------------|-------------------------------------------------|------|
| Frontend      | React 18, Vite, TypeScript, Tailwind, Recharts  | 5173 |
| Backend       | Express 5, TypeScript, SQLite, JWT, Passport    | 3001 |
| AI-service    | Python, FastAPI, ML models                      | 8001 |
| Task queue    | Redis (Docker)                                  | 6379 |

## Repository layout

```
miyu/
├── frontend/         # React 18 + Vite + TypeScript + Tailwind
├── backend/          # Express 5 + TypeScript + SQLite
├── ai-service/       # Python + FastAPI + ML models
├── database/         # SQLite schema, migrations, Docker configs
├── deploy/           # Nginx configuration for production
└── scripts/          # Development utilities (dev-all.cjs)
```

## Features

- **Accounts & social login** — registration, JWT tokens, OAuth via
  GitHub / VK / Yandex (Passport strategies).
- **Music catalog** — artists, albums, tracks, videos with moderation.
- **User library** — playlists, listening history, likes.
- **Social** — friends, follows, notifications.
- **Concerts & tickets** — events, transactions, payments.
- **Gamification** — achievements.
- **AI features** — recommendations, track analysis, transcription
  benchmarking (WER / CER / recall / precision / F1).
- **Admin panel** — content moderation, user management.

## Requirements

- Node.js 18+
- Python 3.10+ (for the AI-service)
- Docker (to run Redis)
- SQLite 3 (bundled with the backend driver)

## Quick start (development)

```bash
# 1. Clone and enter the project
git clone https://github.com/klimenkod406/miyu.d.git
cd miyu.d/miyu

# 2. Start Redis (required for the AI-service)
cd database
docker compose up -d redis
cd ..

# 3. Install dependencies
npm install                       # root dev runner
( cd frontend && npm install )
( cd backend  && npm install )
( cd ai-service && python -m venv .venv && \
  .venv/Scripts/python.exe -m pip install -r requirements.txt )

# 4. Run everything together
npm run dev   # uses scripts/dev-all.cjs
```

Or run each service on its own:

```bash
cd frontend && npm run dev       # http://localhost:5173
cd backend  && npm run dev       # http://localhost:3001
cd ai-service && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8001
```

## Production deployment

See `miyu/deploy/` for the Nginx configuration. The included
`docker-compose.prod.yml` brings the full stack up on a single host.

## API surface

The backend exposes 27+ REST route modules under `/api/*`:

`auth`, `user`, `admin`, `artist`, `artist-albums`, `artist-videos`,
`album`, `track`, `videos`, `moderation`, `likes`, `playlists`,
`history`, `friendships`, `following`, `notifications`, `concerts`,
`transactions`, `achievements`, `search`, `support`, `ai`, `recsys`,
`home`.

Guests can only reach the home page (`/`). All other routes require
authentication.

## AI / transcription benchmarking

```bash
cd ai-service
.venv/Scripts/python.exe tests/test_benchmark.py --track 34 --config baseline
.venv/Scripts/python.exe tests/test_benchmark.py --track 34 --all-configs
```

Reports include Word Error Rate (WER), Character Error Rate (CER),
recall, precision, F1 and segment coverage. Results land in
`ai-service/tests/benchmark_results/`.

## Tech-stack documentation

`miyu/TECH_STACK.md` (in this repo) walks through every framework and
library used in the project, with code excerpts from the actual source.

## License

MIT — see `LICENSE`.