# VPS Specification Verification

**Target:** `161.104.19.164`  
**Date:** 2026-06-19  
**Project:** Miyu production deployment (Docker Compose — 6 services + Whisper large-v3)

---

## SSH Connectivity

| Check | Result | Details |
|-------|--------|---------|
| Host reachable (ICMP ping) | ✅ PASS | `Test-Connection` returns `True` |
| TCP port 22 open | ✅ PASS | `Test-NetConnection -Port 22` succeeds |
| SSH authentication | ❌ FAIL | `Permission denied (publickey,password)` — key not authorized |

**Verdict:** Server is reachable on port 22, but the deployment agent's SSH key is not authorized.
Run the verification commands **manually** from a machine with an authorized key.

---

## Manual Verification Instructions

Run this command on a machine with SSH key access to the VPS:

```bash
ssh root@161.104.19.164 '
echo "=== CPU ==="
nproc
echo "=== RAM ==="
free -h
echo "=== DISK ==="
df -h /
echo "=== OS ==="
cat /etc/os-release
echo "=== DOCKER ==="
docker --version 2>/dev/null || echo "Docker not installed"
docker compose version 2>/dev/null || echo "Docker Compose not installed"
'
```

Paste the output below and fill in the `Actual` column.

---

## Specification Comparison

| Resource | Minimum Requirement | Actual (from VPS) | Status |
|----------|-------------------|-------------------|--------|
| **vCPU** | **4** (Whisper large-v3 + 6 services + workers) | `UNKNOWN — run command` | ⬜ PENDING |
| **RAM** | **8 GB** (large-v3 peak ~5 GB + services ~3 GB) | `UNKNOWN — run command` | ⬜ PENDING |
| **SSD** | **50 GB** (models ~5 GB + tracks + Docker images) | `UNKNOWN — run command` | ⬜ PENDING |
| **OS** | Linux (Ubuntu 22.04+ / Debian 12+ recommended) | `UNKNOWN — run command` | ⬜ PENDING |
| **Docker** | Docker 24+ with Compose plugin | `UNKNOWN — run command` | ⬜ PENDING |

### Row-by-row guidelines

| Resource | PASS | WARN | FAIL |
|----------|------|------|------|
| **vCPU** | ≥ 4 cores | 2–3 cores | < 2 cores |
| **RAM** | ≥ 8 GB total | 4–7 GB | < 4 GB |
| **SSD** | ≥ 50 GB available | 30–49 GB | < 30 GB |
| **OS** | Ubuntu 22.04+ / Debian 12+ | Ubuntu 20.04 / Debian 11 | Older / unsupported distro |
| **Docker** | Docker 24+ + Compose plugin | Docker 20–23 | Not installed / no compose |

---

## Resource Budget (Estimated)

| Consumer | Est. RAM | Est. CPU | Est. Disk | Notes |
|----------|----------|----------|-----------|-------|
| Whisper large-v3 (int8) | **4–5 GB** peak | 2–4 cores at inference | ~3 GB model | Peak during audio transcription |
| Redis (queue + cache) | 256 MB | 0.5 core | 100 MB | Minimal for job queue |
| Backend (Node.js) | 512 MB | 1 core | ~200 MB | Express + SQLite |
| Frontend (nginx static) | 64 MB | 0.1 core | ~100 MB | Static files + nginx |
| AI-service (FastAPI) | 1.5 GB | 1 core | ~500 MB | torch + PANNs + embeddings |
| AI-worker (background) | 1.5 GB | 1 core | ~500 MB | Same model loading |
| Docker overhead + OS | 1 GB | 1 core | 10 GB | Base system + Docker images |
| Audio tracks + uploads | — | — | 10–30 GB | Variable, depends on library size |
| **Total estimated** | **~8–9 GB** | **~4–6 cores** | **~25–44 GB** | With large-v3 + 1 worker |

> **Note:** With only 1 AI worker and `large-v3`, peak RAM during transcription spikes to ~5 GB.
> The other services run at low baseline, keeping total under 8 GB in steady state.
> **Spikes can exceed 8 GB** if multiple workers transcribe simultaneously — configure `MIYU_AI_WHISPER_NUM_WORKERS=1` to stay safe.

---

## Pipeline Benchmarks (Reference)

Source: Real runs on Ryzen 5600X (6C/12T, 32 GB RAM, Linux)

| Metric | Value | Notes |
|--------|-------|-------|
| **Peak RAM (large-v3 int8)** | 4–5 GB | During transcription of ~4 min track |
| **Avg. time per track** | 2.1 min | ~4 min audio, large-v3, int8, 1 worker |
| **Model size (large-v3)** | ~3 GB | Downloaded to `~/.cache/whisper/` on first run |
| **torch + torchaudio** | ~1.5 GB | CPU-only PyTorch install in Docker |
| **PANNs embeddings** | ~0.5 GB | Loaded on demand for genre/tag analysis |

---

## Expected Status After Manual Check

After running the SSH command above, update this document with the actual output.

**Example of a PASS result:**

| Resource | Minimum | Actual | Status |
|----------|---------|--------|--------|
| vCPU | 4 | 4 | ✅ PASS |
| RAM | 8 GB | 7.6 GB | ✅ PASS (OK) |
| SSD | 50 GB | 78 GB | ✅ PASS |
| OS | Linux | Ubuntu 24.04 LTS | ✅ PASS |
| Docker | 24+ | Docker 27.1.1 | ✅ PASS |

**Example of a WARN result:**

| Resource | Minimum | Actual | Status |
|----------|---------|--------|--------|
| vCPU | 4 | 2 | ⚠️ WARN — may bottleneck on simultaneous transcription |
| RAM | 8 GB | 3.8 GB | ❌ FAIL — below minimum for large-v3 |

---

## To Fill In

1. Run the SSH command from [Manual Verification](#manual-verification-instructions).
2. Copy the output into the `Actual` column of the [Specification Comparison](#specification-comparison) table.
3. Set each row's Status to ✅ PASS, ⚠️ WARN, or ❌ FAIL based on the guidelines.
4. If any item FAILs, stop and upgrade the VPS before deploying.
