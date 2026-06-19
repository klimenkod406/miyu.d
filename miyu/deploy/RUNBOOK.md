# Miyu Deployment Runbook

Step-by-step guide for deploying and operating Miyu on a single VPS.
Target: `161.104.19.164` | Project path: `/root/miyu` | OS: Ubuntu 22.04 / 24.04

---

## 1. Prerequisites

### VPS Specs (minimum for AI demo)
- 4 vCPU, 8 GB RAM, 60+ GB SSD
- Ubuntu 22.04 or 24.04
- Root SSH access with key authentication
- Outbound internet access (Docker Hub, GitHub, Hugging Face)

### Lower spec (weak demo)
- 2 vCPU, 4 GB RAM, model forced to `tiny`
- AI analysis will be slow
- Not suitable for concurrent users

### What you need before starting
| Item | Details |
|------|---------|
| VPS IP | 161.104.19.164 |
| SSH user | root (key auth) |
| Git repo | `git@github.com:your-org/miyu.git` |
| Domain | None (self-signed HTTPS on IP) |
| Local machine | Git, `ssh`, `scp` |

### Verify SSH access
```bash
ssh root@161.104.19.164
# Expected: you land in a shell, no password prompt
```

---

## 2. Initial Server Setup

### Step 2.1: Copy the init script to VPS and run it
```bash
scp deploy/vps-init.sh root@161.104.19.164:/root/vps-init.sh
ssh root@161.104.19.164 "bash /root/vps-init.sh"
```

### Step 2.2: Verify everything installed
```bash
ssh root@161.104.19.164
docker --version
# Expected: Docker version 27.x.x, build xxxxxxx

docker compose version
# Expected: Docker Compose version v2.x.x-desktop.x

ufw status verbose
# Expected:
# Status: active
# Logging: on (low)
# Default: deny (incoming), allow (outgoing)
# 22/tcp                   ALLOW IN    (SSH)
# 80/tcp                   ALLOW IN    (HTTP)
# 443/tcp                  ALLOW IN    (HTTPS)

fail2ban-client status sshd
# Expected:
# Status for the jail: sshd
# |- Currently banned: 0
# |- Total banned: 0
# `- Banned IP list:
```

### Step 2.3: Verify directories exist
```bash
ls -la /etc/nginx/ssl /var/www/uploads /data
# Expected: all directories present (created by vps-init.sh)
```

---

## 3. First Deployment

### Step 3.1: Clone the repository
```bash
cd /root
git clone git@github.com:your-org/miyu.git
cd /root/miyu
```

### Step 3.2: Create the production env file
```bash
cp .env.production.example .env.production
```

### Step 3.3: Generate and set a strong JWT secret
```bash
openssl rand -hex 32
# Example output: a7b3c9d1e2f4...
# Edit .env.production and set JWT_SECRET to this value
```

### Step 3.4: Adjust AI worker settings for your VPS
Edit `.env.production`:
```env
AI_SERVICE_ENABLED=true
MIYU_AI_WHISPER_MODEL=base       # tiny for 4GB RAM, base for 8GB, small for 16GB+
MIYU_AI_WHISPER_DEVICE=cpu
MIYU_AI_WHISPER_COMPUTE_TYPE=int8
MIYU_AI_WHISPER_NUM_WORKERS=1    # always 1 on single VPS
```

### Step 3.5: Build and start all services
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build
# Expected: builds 5 images (frontend, backend, ai-service, ai-worker, nginx pulls from hub)
# This takes 5-15 minutes depending on VPS speed

docker compose --env-file .env.production -f docker-compose.prod.yml up -d
# Expected: 6 containers created and started
```

### Step 3.6: Verify all containers are healthy
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
# Expected output:
# NAME              STATUS
# miyu-frontend     Up (healthy)
# miyu-backend      Up (healthy)
# miyu-ai-service   Up (healthy)
# miyu-ai-worker    Up (healthy)
# miyu-redis        Up (healthy)
# miyu-nginx        Up (healthy)
```

### Step 3.7: Smoke test the health endpoints
```bash
# Backend API
curl -k https://161.104.19.164/api/health
# Expected: {"status":"ok","timestamp":"..."}

# AI service
curl -k https://161.104.19.164/ai/health
# Expected: {"status":"healthy","model":"base","device":"cpu"}

# Frontend
curl -k https://161.104.19.164/ | head -5
# Expected: <!DOCTYPE html><html lang="en">...
```

---

## 4. SSL Setup (Self-Signed)

### Step 4.1: Generate the self-signed certificate
```bash
ssh root@161.104.19.164
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/nginx.key \
  -out /etc/nginx/ssl/nginx.crt \
  -subj "/CN=161.104.19.164"
# Expected: no output, cert files created
```

### Step 4.2: Verify the cert files exist
```bash
ls -la /etc/nginx/ssl/
# Expected:
# -rw-r--r-- nginx.crt
# -rw------- nginx.key
```

### Step 4.3: Verify the nginx config mounts them
The nginx config at `deploy/nginx/default.conf` references:
```nginx
ssl_certificate /etc/nginx/ssl/nginx.crt;
ssl_certificate_key /etc/nginx/ssl/nginx.key;
```

These paths are mounted from the host `/etc/nginx/ssl/` into the nginx container.
If you restart nginx after generating certs, it picks them up automatically:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart nginx
```

### Step 4.4: Verify HTTPS redirect works
```bash
curl -I http://161.104.19.164 2>&1 | head -5
# Expected:
# HTTP/1.1 301 Moved Permanently
# Location: https://161.104.19.164/
```

---

## 5. Database Migration

### Step 5.1: Transfer existing database from local to VPS
```bash
# On your local machine
scp database/miyu.db root@161.104.19.164:/root/miyu/database/miyu.db
# Expected: file copied, size shown
```

### Step 5.2: Verify database integrity on VPS
```bash
ssh root@161.104.19.164
cd /root/miyu
sqlite3 database/miyu.db "PRAGMA integrity_check;"
# Expected: "ok"

sqlite3 database/miyu.db "PRAGMA journal_mode;"
# Expected: "wal" (WAL mode is set by the backend on startup)
```

### Step 5.3: Restart backend to pick up the new database
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart backend
# Expected: backend restarts, health check passes within 10s
```

### Step 5.4: Verify data is accessible
```bash
curl -k https://161.104.19.164/api/health
# Expected: {"status":"ok",...}
```

---

## 6. CI/CD Setup

### Step 6.1: Add GitHub secrets
Go to your GitHub repo: Settings > Secrets and variables > Actions > New repository secret.

| Secret name | Value |
|-------------|-------|
| `VPS_HOST` | `161.104.19.164` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Private SSH key (the full `-----BEGIN OPENSSH PRIVATE KEY-----` block) |

### Step 6.2: Verify the workflow file exists
```bash
cat .github/workflows/deploy.yml
# Expected: workflow with build, deploy, health check, and rollback steps
```

The workflow triggers on push to `main`:
```yaml
on:
  push:
    branches: [main]
```

Deployment steps:
1. Checkout code
2. Build Docker images
3. Run tests (non-blocking, `|| true`)
4. SSH into VPS, `git pull`, `docker compose up -d --build`
5. Health check with 10 retries
6. Rollback on failure

### Step 6.3: Trigger a manual deploy (optional)
```bash
git push origin main
# Watch the Actions tab for progress
```

---

## 7. Daily Operations

### 7.1: View service logs
```bash
# All services
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 -f

# Specific service
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=50 -f backend
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=50 -f ai-worker
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=50 -f nginx

# Filter by time
docker compose --env-file .env.production -f docker-compose.prod.yml logs --since=10m
```

### 7.2: Check service health
```bash
# Quick status overview
docker compose --env-file .env.production -f docker-compose.prod.yml ps

# HTTP health endpoints
curl -k https://161.104.19.164/api/health
curl -k https://161.104.19.164/ai/health

# Container resource usage
docker stats --no-stream
```

### 7.3: Backup the database
```bash
# Manual backup
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend \
  bash -c "sqlite3 /app/database/miyu.db '.backup /app/database/backup_manual.db'"
cp database/backup_manual.db database/backups/miyu.db.backup.$(date +%Y%m%d_%H%M%S)
rm database/backup_manual.db

# Using the backup script (runs from host)
bash scripts/backup-db.sh
# Expected output:
# Backing up database/miyu.db to database/backups/miyu.db.backup.20250101_120000
# Verifying integrity...
# Integrity: OK
# Rotating old backups (keeping last 7)...
# Backup complete: database/backups/miyu.db.backup.20250101_120000
```

### 7.4: Schedule automatic backups (cron)
```bash
crontab -e
# Add line:
0 3 * * * cd /root/miyu && bash scripts/backup-db.sh >> /var/log/miyu-backup.log 2>&1
```

### 7.5: Restore from backup
```bash
bash scripts/restore-db.sh database/backups/miyu.db.backup.20250101_120000
# Expected:
# Restoring database/backups/miyu.db.backup.20250101_120000 to database/miyu.db
# Verifying backup integrity...
# Backup integrity: OK
# Restore complete.
```

### 7.6: Restart a single service
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart backend
docker compose --env-file .env.production -f docker-compose.prod.yml restart ai-worker
```

### 7.7: Update the deployment
```bash
git pull origin main
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
# Check health after update
curl -k https://161.104.19.164/api/health
```

---

## 8. Troubleshooting

### Scenario 1: AI worker OOM (out of memory)

**Symptoms:**
- `docker logs miyu-ai-worker --tail=20` shows `Killed` or exit code 137
- `docker compose ps` shows `miyu-ai-worker` restarting in a loop
- System `dmesg | tail` shows OOM killer messages

**Check:**
```bash
docker logs --tail=50 miyu-ai-worker
# Look for: "Killed", "exit code 137", or memory allocation errors
dmesg | grep -i oom | tail -5
# Look for: "oom-kill" referencing ai-worker
```

**Fix:**
```bash
# 1. Reduce worker count to 1 (already the default, but verify)
sed -i 's/MIYU_AI_WHISPER_NUM_WORKERS=.*/MIYU_AI_WHISPER_NUM_WORKERS=1/' .env.production

# 2. Downsize model
sed -i 's/MIYU_AI_WHISPER_MODEL=.*/MIYU_AI_WHISPER_MODEL=tiny/' .env.production

# 3. Restart ai-worker
docker compose --env-file .env.production -f docker-compose.prod.yml up -d ai-worker

# 4. Verify memory limits in docker-compose.prod.yml:
#    ai-service and ai-worker both have: memory: 6g
#    On an 8GB VPS, 6g + 1g (backend) + 512m (frontend) + 512m (redis) = ~8GB
#    If OOM persists, lower ai-worker limit to 4g in docker-compose.prod.yml
```

### Scenario 2: Container won't start

**Symptoms:**
- `docker compose ps` shows `Exit` or `Restarting` for one or more containers
- Health check endpoint returns connection refused

**Check:**
```bash
# View overall status
docker compose --env-file .env.production -f docker-compose.prod.yml ps
# Example output:
# NAME              STATUS
# miyu-backend      Exit 1
# miyu-ai-service   Restarting

# Inspect the failing container
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=50 backend
# Look for: error stack trace, missing env vars, port conflicts

# Check if the image built successfully
docker images | grep miyu
```

**Fix:**
```bash
# Common causes and fixes:

# Missing env var (JWT_SECRET not set)
docker compose --env-file .env.production -f docker-compose.prod.yml config
# Check if JWT_SECRET shows as empty

# Port conflict (port 80 or 3001 already in use)
ss -tlnp | grep -E ':(80|443|3001|8001|6379)\b'
# If something else is using the port, stop it or change the mapping

# Rebuild and restart
docker compose --env-file .env.production -f docker-compose.prod.yml build backend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d backend

# Full reset (keeps volumes)
docker compose --env-file .env.production -f docker-compose.prod.yml down
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### Scenario 3: Database locked (SQLITE_BUSY)

**Symptoms:**
- Backend logs show `SQLITE_BUSY` or `database is locked`
- API returns 500 errors on write operations
- Health check passes but data operations fail

**Check:**
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=30 backend
# Look for: "SQLITE_BUSY", "database is locked"

# Check journal mode (must be WAL for concurrent reads)
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend \
  sqlite3 /app/database/miyu.db "PRAGMA journal_mode;"
# Expected: "wal"
# If "delete" or "truncate", WAL mode is not set
```

**Fix:**
```bash
# 1. Restart backend to re-enable WAL mode
docker compose --env-file .env.production -f docker-compose.prod.yml restart backend

# 2. If still locked, force WAL mode
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend \
  sqlite3 /app/database/miyu.db "PRAGMA journal_mode=WAL;"

# 3. As last resort, stop all containers, enable WAL, restart
docker compose --env-file .env.production -f docker-compose.prod.yml down
sqlite3 database/miyu.db "PRAGMA journal_mode=WAL;"
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### Scenario 4: Site not reachable

**Symptoms:**
- Browser shows connection refused or timeout
- `curl` returns no response
- Other services on the VPS are reachable

**Check:**
```bash
# 1. Is the VPS reachable at all?
ping -c 3 161.104.19.164

# 2. Are the containers running?
docker compose --env-file .env.production -f docker-compose.prod.yml ps

# 3. Is ufw blocking the ports?
ufw status verbose
# Expected: 80/tcp and 443/tcp ALLOW IN

# 4. Are nginx and Docker networking healthy?
docker logs miyu-nginx --tail=30
# Look for: connection refused to backend/frontend

# 5. Is nginx listening?
ss -tlnp | grep -E ':(80|443)\b'

# 6. Check nginx config syntax
docker compose --env-file .env.production -f docker-compose.prod.yml exec nginx \
  nginx -t
# Expected: syntax is ok, test is successful
```

**Fix by layer:**
```bash
# Layer 1: Docker networking broken
docker compose --env-file .env.production -f docker-compose.prod.yml restart nginx

# Layer 2: ufw blocking (should not happen, vps-init.sh configures it)
ufw allow 80/tcp
ufw allow 443/tcp

# Layer 3: nginx config error
docker compose --env-file .env.production -f docker-compose.prod.yml exec nginx \
  nginx -s reload

# Layer 4: Full restart
docker compose --env-file .env.production -f docker-compose.prod.yml down
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# Layer 5: Hard reset
systemctl restart docker
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

---

## 9. Rollback Procedure

### Step 9.1: Identify the previous working state
```bash
cd /root/miyu

# List recent commits
git log --oneline -10
# Example:
# a1b2c3d Add new AI feature
# e4f5g6h Fix moderation bug
# i7j8k9l Previous working commit
```

### Step 9.2: Roll back the code
```bash
# Roll back to the previous commit
git checkout e4f5g6h

# Or roll back by one commit
git checkout HEAD~1

# Or roll back by tag (create tags before deployment)
git checkout v1.0.0
```

### Step 9.3: Rebuild and redeploy
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### Step 9.4: Verify the rollback
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
# Expected: all 6 containers healthy

curl -k https://161.104.19.164/api/health
# Expected: {"status":"ok"}

# Check that the problematic feature is gone
# Run any manual tests relevant to the broken feature
```

### Step 9.5: If you need to roll back the database too
```bash
# Find the backup taken before the problematic deploy
ls -t database/backups/

# Restore it
bash scripts/restore-db.sh database/backups/miyu.db.backup.BEFORE_TIMESTAMP

# Restart backend
docker compose --env-file .env.production -f docker-compose.prod.yml restart backend
```

### Step 9.6: Investigate the root cause before re-deploying
```bash
# Check what changed
git diff e4f5g6h..a1b2c3d --stat

# Check logs from the failed deployment
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 backend
```

---

## Reference: Deployment Artifacts

| File | Path | Purpose |
|------|------|---------|
| Compose file | `docker-compose.prod.yml` | 6 services with health checks and resource limits |
| Init script | `deploy/vps-init.sh` | Installs Docker, ufw, fail2ban, openssl |
| Nginx config | `deploy/nginx/default.conf` | HTTPS with self-signed cert, proxy to services |
| Env template | `.env.production.example` | Template for production environment |
| Env file | `.env.production` | Actual secrets (never commit) |
| Backup script | `scripts/backup-db.sh` | DB backup with integrity check, keeps last 7 |
| Restore script | `scripts/restore-db.sh` | DB restore with pre-restore snapshot |
| CI/CD workflow | `.github/workflows/deploy.yml` | Auto-deploy on push to main with rollback |
| Database | `database/miyu.db` | SQLite database (WAL mode) |
| Uploads | `uploads/` | Tracks, avatars, videos |
| AI model cache | `ai_models_cache` (Docker volume) | Whisper model cache |

## Resource Limits (from docker-compose.prod.yml)

| Service | Memory Limit |
|---------|-------------|
| frontend | 512m |
| backend | 1g |
| redis | 512m |
| ai-service | 6g |
| ai-worker | 6g |
| nginx | 256m |
| **Total** | **~14 GB** |

On an 8 GB VPS, the two AI services at 6g each will not both fit at full allocation.
The kernel's memory overcommit allows it, but if both hit peak usage, OOM is likely.
**Recommendation:** Lower `ai-worker` memory to 4g in `docker-compose.prod.yml` if OOM persists.
