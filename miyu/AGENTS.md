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

## Key Conventions

- Tailwind CSS for styling (dark theme with glassmorphism)
- React Router for routing with `GuestHomeOnlyGate` protection
- JWT + refresh tokens auth pattern (access 7d, refresh 30d)
- Real payment system integration (ЮKassa)
- AI-service integration via HTTP fire-and-forget pattern

## Development Notes

- AI-service has Python tests in `ai-service/tests/`
- Backend uses SQLite with manual SQL/TypeScript migrations
- Frontend proxies `/api/*` requests to backend (port 3001)
- Docker required for Redis (AI-service queue)
- Run `npm run build` before deployment (Vite)
- Production deployment uses Docker Compose (`docker-compose.prod.yml`)