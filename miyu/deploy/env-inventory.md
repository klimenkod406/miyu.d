# Environment Variable Inventory

> Generated from `.env.production.example` × `.env.production` cross-reference.
> Date: 2026-06-19

---

## Table of Contents

- [Variables from `.env.production.example`](#variables-from-envproductionexample)
- [Extras in `.env.production` (not in example)](#extras-in-envproduction-not-in-example)
- [Known Missing (referenced in code, not in either file)](#known-missing-referenced-in-code-not-in-either-file)
- [Summary](#summary)
- [Action Items](#action-items)

---

## Variables from `.env.production.example`

| # | Variable | Current Value | Status | SECRET | Notes |
|---|----------|--------------|--------|--------|-------|
| 1 | `JWT_SECRET` | `bec2e652dc80…39` (hex, 64 chars) | ✅ OK | 🔒 SECRET | Properly generated random 32-byte hex |
| 2 | `AI_SERVICE_ENABLED` | `true` | ✅ OK | | |
| 3 | `SEED_TRACKS_DIR` | `/app/seed-content/tracks` | ✅ OK | | |
| 4 | `MIYU_AI_LOG_LEVEL` | `INFO` | ✅ OK | | |
| 5 | `MIYU_AI_WHISPER_MODEL` | `base` | ⚠️ WRONG_DEFAULT | | **Must be `large-v3`** for production quality; `base` has poor accuracy on music |
| 6 | `MIYU_AI_WHISPER_DEVICE` | `cpu` | ✅ OK | | |
| 7 | `MIYU_AI_WHISPER_COMPUTE_TYPE` | `int8` | ✅ OK | | |
| 8 | `MIYU_AI_WHISPER_NUM_WORKERS` | `1` | ✅ OK | | |
| 9 | `MIYU_AI_ENABLE_TOXICITY_MODEL` | `false` | ✅ OK | | CPU-safe default |
| 10 | `MIYU_AI_ENABLE_TEXT_EMBEDDINGS` | `false` | ✅ OK | | CPU-safe default |
| 11 | `HF_HUB_DISABLE_XET` | `1` | ✅ OK | | Prevents HF Xet download timeout |
| 12 | `MAIL_HOST` | `smtp.gmail.com` | ✅ OK | | Was commented-out in example, now active |
| 13 | `MAIL_PORT` | `587` | ✅ OK | | Was commented-out in example, now active |
| 14 | `MAIL_USER` | `klimenkod406@gmail.com` | ✅ OK | | Was empty in example, now set |
| 15 | `MAIL_PASS` | `***set***` | ✅ OK | 🔒 SECRET | Gmail App Password — set, do not expose |
| 16 | `MAIL_FROM` | `klimenkod406@gmail.com` | ✅ OK | | Was empty in example, now set |

### Placeholder / Commented-Out Status

- Variables `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` were **commented out and empty** in `.env.production.example`.
- In `.env.production` they are **uncommented and populated** → resolved.

---

## Extras in `.env.production` (not in example)

| # | Variable | Value | Notes |
|---|----------|-------|-------|
| 1 | `MAX_UPLOAD_MB` | `200` | Upload size limit in MB |
| 2 | `MAX_BATCH_FILES` | `100` | Max files per batch upload |

These are operational defaults — no placeholder issues.

---

## Known Missing (referenced in code, not in either file)

These variables are **read by the application code** but absent from both `.env.production` and `.env.production.example`. They rely on fallback defaults.

| # | Variable | Fallback Default | SECRET | Risk |
|---|----------|-----------------|--------|------|
| 1 | `PORT` | `3001` | | Hardcoded in docker-compose, low risk |
| 2 | `DB_PATH` | `../database/miyu.db` | | Docker compose overrides; hardcoded fallback for dev |
| 3 | `AI_SERVICE_URL` | `http://localhost:8001` | | Docker compose overrides, low risk |
| 4 | `MIYU_AI_REDIS_URL` | *(hardcoded in docker-compose)* | | Set in compose, not in env file |
| 5 | `MIYU_AI_DB_PATH` | *(hardcoded in docker-compose)* | | Set in compose, not in env file |
| 6 | `MIYU_AI_STORAGE_ROOT` | *(hardcoded in docker-compose)* | | Set in compose, not in env file |
| 7 | `SESSION_SECRET` | `miyu-session-secret-for-oauth` | 🔒 SECRET | Falls back to **hardcoded weak default** — HIGH RISK |
| 8 | `FRONTEND_URL` | `http://localhost:5173` | | OAuth redirects fallback to dev URL |
| 9 | `GITHUB_CLIENT_ID` | *(not set)* | 🔒 SECRET | No fallback — OAuth disabled |
| 10 | `GITHUB_CLIENT_SECRET` | *(not set)* | 🔒 SECRET | No fallback — OAuth disabled |
| 11 | `GITHUB_CALLBACK_URL` | *(not set)* | | No fallback |
| 12 | `YANDEX_CLIENT_ID` | *(not set)* | 🔒 SECRET | No fallback — OAuth disabled |
| 13 | `YANDEX_CLIENT_SECRET` | *(not set)* | 🔒 SECRET | No fallback — OAuth disabled |
| 14 | `YANDEX_CALLBACK_URL` | *(not set)* | | No fallback |
| 15 | `VK_CLIENT_ID` | *(not set)* | 🔒 SECRET | No fallback — OAuth disabled |
| 16 | `VK_CLIENT_SECRET` | *(not set)* | 🔒 SECRET | No fallback — OAuth disabled |
| 17 | `VK_CALLBACK_URL` | *(not set)* | | No fallback |

---

## Summary

### Variables from `.env.production.example`

| Status | Count |
|--------|-------|
| ✅ OK | **14** |
| ⚠️ WRONG_DEFAULT | **1** |
| ❌ NEEDS_VALUE | **0** |
| 🔒 SECRETS flagged | **2** (`JWT_SECRET`, `MAIL_PASS`) |

### Extras (not in example, no issues)

| Category | Count |
|----------|-------|
| Extra operational vars | **2** (`MAX_UPLOAD_MB`, `MAX_BATCH_FILES`) |

### Known Missing (code-only, no env presence)

| Category | Count |
|----------|-------|
| Missing from both files | **17** |
| Of which — SECRET | **8** |
| Of which — HIGH RISK fallback | **1** (`SESSION_SECRET` — hardcoded `miyu-session-secret-for-oauth`) |

---

## Action Items

1. **CRITICAL** — `MIYU_AI_WHISPER_MODEL` must be changed from `base` to `large-v3` for production-quality transcription.
2. **CRITICAL** — `SESSION_SECRET` must be explicitly set in `.env.production` (currently falls back to a hardcoded dev secret).
3. **HIGH** — Add OAuth variables (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `VK_CLIENT_ID`, `VK_CLIENT_SECRET`) to `.env.production` and `.env.production.example` with proper placeholders.
4. **HIGH** — Add OAuth callback URLs (`GITHUB_CALLBACK_URL`, `YANDEX_CALLBACK_URL`, `VK_CALLBACK_URL`) to both env files.
5. **MEDIUM** — Add `FRONTEND_URL` to `.env.production.example` (currently falls back to dev `localhost:5173`).
6. **LOW** — Add `PORT`, `DB_PATH`, `AI_SERVICE_URL` to `.env.production.example` for documentation completeness (currently overridden in docker-compose or have safe defaults).
7. **LOW** — Add `MIYU_AI_REDIS_URL`, `MIYU_AI_DB_PATH`, `MIYU_AI_STORAGE_ROOT` to `.env.production.example`.
