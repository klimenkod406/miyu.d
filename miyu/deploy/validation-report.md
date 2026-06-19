# Production Config Validation Report

**Date:** 2026-06-19  
**Scope:** `miyu/docker-compose.prod.yml` + all 6 services + environment files  
**Status:** ⚠️ 2 CRITICAL issues, 5 WARNINGs, 4 INFO items

---

## Docker Compose Syntax

| Check | Result |
|-------|--------|
| `docker compose -f docker-compose.prod.yml config` | ✅ **PASS** — syntax valid, all 6 services resolved |
| Services resolved | `frontend`, `backend`, `redis`, `ai-service`, `ai-worker`, `nginx` |
| Networks | 1 default bridge network (`miyu_default`) |
| Volumes | 1 named volume (`ai_models_cache`) |

**Note:** One warning during validation: `JWT_SECRET` not set (blank string default). This only occurs when running without `--env-file .env.production`. When deployed correctly with the env file, this is resolved.

---

## Nginx Config

**File:** `miyu/deploy/nginx/default.conf` (60 lines)

### ✅ Good Practices
- `client_max_body_size 200M` — appropriate for audio uploads
- Docker DNS resolver (`127.0.0.11`) with `valid=10s` — enables dynamic service discovery
- Gzip compression enabled with good coverage (`gzip_types` covers all web formats)
- Upload locations have `access_log off` and `expires` caching headers
- `proxy_set_header` chain complete (Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto)

### ⚠️ Issues

| Severity | Issue | Details |
|----------|-------|---------|
| **HIGH** | **No HTTPS/SSL** | Listens only on port 80. No TLS certificates, no SSL termination, no redirect to HTTPS. All traffic is plain HTTP. |
| MEDIUM | No WebSocket support | `proxy_set_header Upgrade` and `Connection` headers absent. If backend uses WebSockets, connections will fail. |
| LOW | No rate limiting | No `limit_req_zone` or `limit_conn_zone` — API is unprotected against brute-force. |
| LOW | No security headers | Missing: `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`. |

### Location Routing

| Location | Upstream | Notes |
|----------|----------|-------|
| `/api/` | `backend:3001` | API proxy |
| `/ai/` | `ai-service:8001` | AI service proxy (note: trailing `/` in `proxy_pass`) |
| `/uploads/avatars/` | alias `/var/www/uploads/avatars/` | Separate caching: 1h, `must-revalidate` |
| `/uploads/` | alias `/var/www/uploads/` | Static files: 7d cache |
| `/` | `frontend:80` | SPA catch-all |

---

## Dockerfiles

### 1. Frontend Dockerfile (`frontend/Dockerfile`)

| Check | Status |
|-------|--------|
| Base image | ✅ `node:20-bookworm-slim` (builder) → `nginx:1.27-alpine` (runner) |
| Multi-stage | ✅ Yes — 4.4MB final image (alpine) |
| Package install | ✅ `npm ci` (reproducible) |
| Exposed port | ✅ `EXPOSE 80` |
| `.dockerignore` | ❌ **MISSING** — `node_modules`, `dist`, `.env` will be copied to build context |
| Health check | ❌ **MISSING** |
| Custom config | ✅ Copies `frontend/nginx.conf` (simple SPA static server at port 80) |

**Frontend nginx.conf** (`frontend/nginx.conf`, 16 lines): Serves static files with SPA fallback (`try_files $uri $uri/ /index.html`), `/assets/` cached for 1y with `immutable`. Clean and minimal. ✅

### 2. Backend Dockerfile (`backend/Dockerfile`)

| Check | Status |
|-------|--------|
| Base image | ✅ `node:20-bookworm-slim` for both builder and runner |
| Multi-stage | ✅ Yes — builder compiles TS, runner gets only dist + production deps |
| Package install | ✅ `npm ci --omit=dev` with `--build-from-source=sqlite3` |
| Native deps | ✅ Installs python3/make/g++ for sqlite3, then purges them |
| `.dockerignore` | ✅ **EXISTS** — excludes `node_modules`, `dist`, `*.tsbuildinfo`, `.env`, `.env.*`, `coverage` |
| Exposed port | ✅ `EXPOSE 3001` |
| Health check | ❌ **MISSING** |
| Entrypoint | ✅ `docker-entrypoint.sh` — creates dirs (`database/`, `uploads/` subdirs, `tmp/admin-imports`), copies seed uploads if present |
| User | ⚠️ Runs as root (no `USER` directive) |

### 3. AI-Service Dockerfile (`ai-service/Dockerfile`)

| Check | Status |
|-------|--------|
| Base image | ✅ `python:3.11-slim-bookworm` |
| Multi-stage | ❌ **Single stage** — no builder pattern. Dev dependencies in final image. |
| System deps | ✅ ffmpeg, libchromaprint-tools, libsndfile1, build-essential, ca-certificates |
| PyTorch | ✅ CPU-only from official index (`torch==2.4.1`, `torchaudio==2.4.1`) |
| `.dockerignore` | ❌ **MISSING** — no exclusion of `.venv`, `__pycache__`, `.git`, `.pytest_cache` |
| Exposed port | ✅ `EXPOSE 8001` |
| Health check | ❌ **MISSING** |
| User | ⚠️ Runs as root (no `USER` directive) |

---

## Environment Variables

### File Inventory

| File | Purpose | Notes |
|------|---------|-------|
| `.env.production.example` | Template with safe defaults | Committed to repo ✅ |
| `.env.production` | Intended production env | **COMMITTED with secrets** ❌ |
| `.env` | Docker Compose default env | Overrides key values with `large-v3` etc. |

> ⚠️ **CRITICAL**: `.env.production` contains real email credentials (MAIL_USER + MAIL_PASS) and is committed to the repository. This is a security violation.

### Variable Comparison: `.env.production.example` vs `.env.production`

| Variable | `.example` | `.production` | Match? |
|----------|-----------|---------------|--------|
| `JWT_SECRET` | `change-me-to-a-long-random-secret` | `bec2e652dc804f9639...` | ✅ Set properly |
| `AI_SERVICE_ENABLED` | `true` | `true` | ✅ |
| `SEED_TRACKS_DIR` | `/app/seed-content/tracks` | `/app/seed-content/tracks` | ✅ |
| `MAX_UPLOAD_MB` | *(missing)* | `200` | ❌ Missing in example |
| `MAX_BATCH_FILES` | *(missing)* | `100` | ❌ Missing in example |
| `MIYU_AI_LOG_LEVEL` | `INFO` | `INFO` | ✅ |
| `MIYU_AI_WHISPER_MODEL` | `base` | `base` | ⚠️ See critical issue below |
| `MIYU_AI_WHISPER_DEVICE` | `cpu` | `cpu` | ✅ |
| `MIYU_AI_WHISPER_COMPUTE_TYPE` | `int8` | `int8` | ✅ |
| `MIYU_AI_WHISPER_NUM_WORKERS` | `1` | `1` | ⚠️ See critical issue below |
| `HF_HUB_DISABLE_XET` | `1` | `1` | ✅ |
| `MIYU_AI_ENABLE_TOXICITY_MODEL` | `false` | `false` | ✅ |
| `MIYU_AI_ENABLE_TEXT_EMBEDDINGS` | `false` | `false` | ✅ |
| `MAIL_HOST` | `#smtp.gmail.com` (commented) | `smtp.gmail.com` | ❌ Uncommented (has real creds) |
| `MAIL_PORT` | `#587` (commented) | `587` | ❌ Uncommented |
| `MAIL_USER` | `#` (commented) | `klimenkod406@gmail.com` | ❌ Uncommented + committed |
| `MAIL_PASS` | `#` (commented) | `wcfy rahg nlof ttju` | ❌ **SECRET COMMITTED** |
| `MAIL_FROM` | `#` (commented) | `klimenkod406@gmail.com` | ❌ Uncommented |

### The `.env` Override Problem

A third file `miyu/.env` (4 lines) exists separately:

| Variable | `.env.production` | `.env` (override) |
|----------|------------------|-------------------|
| `MIYU_AI_WHISPER_MODEL` | `base` | `large-v3` |
| `MIYU_AI_WHISPER_NUM_WORKERS` | `1` | `3` |
| `MIYU_AI_ENABLE_TOXICITY_MODEL` | `false` | `true` |
| `MIYU_AI_ENABLE_TEXT_EMBEDDINGS` | `false` | `true` |

Docker Compose loads `.env` by default. The production deploy script (`deploy/README.md`) explicitly uses `--env-file .env.production`, which takes precedence. So **deployment behavior depends on which env file is loaded**:
- If deployed via the README script: uses `.env.production` → **model=base, workers=1**
- If deployed without explicit env-file: uses `.env` → **model=large-v3, workers=3**

---

## Critical Issues

### 🔴 CRITICAL #1: Whisper Model Mismatch — `base` vs `large-v3`

| Aspect | Current | Required |
|--------|---------|----------|
| `.env.production.example` | `base` | `large-v3` |
| `.env.production` | `base` | `large-v3` |
| `.env` (docker default) | `large-v3` ✅ | `large-v3` |
| Compose default | `base` | `large-v3` |

**Problem:** Both the example template AND the actual `.env.production` specify `MIYU_AI_WHISPER_MODEL=base`. Only the hidden `.env` file (not documented in deploy/README.md) has the correct `large-v3` value. If someone follows the official deploy docs and copies `.env.production.example` → `.env.production`, they get the `base` model.

**Impact:** The `base` model (≈140MB) has significantly worse transcription accuracy vs `large-v3` (≈3GB). Given the phonetic correction system (236 regex patterns) and 9 test tracks, the project clearly needs high-accuracy transcription.

**Recommendation:** Change default in `.env.production.example` AND `.env.production` to `large-v3`. Add resource warning about 3GB model download + 8GB RAM requirement.

### 🔴 CRITICAL #2: Email Credentials Committed to Repository

**File:** `miyu/.env.production`  
**Leaked secrets:**
- `MAIL_USER=klimenkod406@gmail.com`
- `MAIL_PASS=wcfy rahg nlof ttju` (Gmail App Password)

**Risk:** Anyone with repo access can send emails from this account.

**Recommendation:** Immediately rotate the Gmail App Password. Add `.env.production` to `.gitignore`. Use `.env.production.example` as the template (already done) but keep actual secrets out of version control.

### ⚠️ CRITICAL #3: No Health Checks on 5/6 Services

| Service | Health Check |
|---------|-------------|
| `redis` | ✅ `redis-cli ping` every 5s |
| `frontend` | ❌ Missing |
| `backend` | ❌ Missing |
| `ai-service` | ❌ Missing |
| `ai-worker` | ❌ Missing |
| `nginx` | ❌ Missing |

**Impact:** Docker Compose cannot detect or restart unhealthy containers. If the backend crashes, nginx will still route to a dead service.

### ⚠️ CRITICAL #4: No Resource Limits

No `deploy.resources.limits` on any service. With `large-v3` Whisper model (≈3GB RAM at inference) + 3 workers, OOM is likely on a standard VPS.

| Service | Risk |
|---------|------|
| `ai-service` | **HIGH** — Whisper `large-v3` can consume 4-6GB RAM during inference |
| `ai-worker` | **HIGH** — Same model, same risk |
| `backend` | LOW — Node.js typically < 512MB |
| `redis` | LOW — In-memory queue data, typically < 256MB |

### ⚠️ WARNING: No HTTPS Termination

Nginx listens only on port 80 (HTTP). No SSL certificate, no `listen 443`, no redirect. All traffic, including JWT tokens and email credentials in transit, is plain text.

### ⚠️ WARNING: No Log Rotation

Docker Compose does not configure `logging:` options. Default JSON-file logs will grow indefinitely. For AI service (verbose) and nginx (access logs), this can fill disk.

### ⚠️ WARNING: Redis Persistence Not Configured

Redis uses `redis:7-alpine` with no custom config. Default `save` directives exist but are ephemeral. If Redis restarts, queued transcription jobs are lost.

### ℹ️ INFO: `.dockerignore` Coverage

| Dockerfile | `.dockerignore` | Notes |
|------------|----------------|-------|
| `frontend/Dockerfile` | ❌ **MISSING** | Build context includes entire `frontend/` — `node_modules`, `.env`, `dist` will be sent to Docker daemon |
| `backend/Dockerfile` | ✅ EXISTS | Covers `node_modules`, `dist`, `.env`, `.env.*`, `coverage` |
| `ai-service/Dockerfile` | ❌ **MISSING** | Build context includes `.venv`, `__pycache__`, `.pytest_cache`, `.git` |

---

## Summary

| Category | ✅ Pass | ⚠️ Warn | ❌ Fail |
|----------|---------|---------|---------|
| Docker Compose Syntax | 1 | 0 | 0 |
| Nginx Config | 5 | 4 | 0 |
| Dockerfiles (3) | 12 | 5 | 2 |
| Environment Variables | 12 | 3 | 3 |
| **TOTAL** | **30** | **12** | **5** |

**Top 3 actions required before production deployment:**

1. **Fix Whisper model mismatch** — update `.env.production.example` default from `base` to `large-v3`, and `.env.production` to match.
2. **Remove secrets from repo** — add `.env.production` to `.gitignore`, rotate Gmail App Password.
3. **Add health checks + resource limits** — minimum for `ai-service`, `backend`, and `nginx` to enable Docker orchestration and prevent OOM.

---

*Report generated by automated validation pipeline. See `deploy/README.md` for deployment instructions.*
