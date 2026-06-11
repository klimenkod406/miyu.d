/**
 * Прокси к recsys-эндпоинтам ai-service (Фаза 2).
 *
 * Публичные:
 *  - GET /api/recsys/similar/track/:id?limit=10  — похожие треки.
 *
 * Админские:
 *  - GET  /api/recsys/index/stats   — состояние индекса.
 *  - POST /api/recsys/index/rebuild — принудительный пересбор.
 *
 * AI_SERVICE_URL берётся из env (по умолчанию http://localhost:8001).
 */
import { Router, Response, Request } from 'express';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/auth';

const router = Router();

const AI_BASE = (process.env.AI_SERVICE_URL || 'http://localhost:8001').replace(/\/$/, '');
const AI_ENABLED = (process.env.AI_SERVICE_ENABLED ?? 'true').toLowerCase() !== 'false';

async function aiFetch(path: string, init?: RequestInit): Promise<{ status: number; data: any }> {
  if (!AI_ENABLED) return { status: 503, data: { error: 'ai disabled' } };
  try {
    const r = await fetch(`${AI_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers as any) },
    });
    const text = await r.text();
    let data: any;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: r.status, data };
  } catch (e: any) {
    return { status: 502, data: { error: 'ai-service unreachable', detail: e?.message } };
  }
}

function normalizeTrack(t: any) {
  let coverUrl = t.cover_url;
  if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/uploads/') && !coverUrl.startsWith('data:image/')) {
    coverUrl = `/uploads/tracks/${coverUrl}`;
  }
  let albumCoverUrl = t.album?.cover_url;
  if (albumCoverUrl && !albumCoverUrl.startsWith('http') && !albumCoverUrl.startsWith('/uploads/') && !albumCoverUrl.startsWith('data:image/')) {
    albumCoverUrl = `/uploads/albums/${albumCoverUrl}`;
  }
  let filePath = t.file_path;
  if (filePath && !filePath.startsWith('http') && !filePath.startsWith('/uploads/')) {
    filePath = `/uploads/tracks/${filePath}`;
  }
  return {
    ...t,
    cover_url: coverUrl,
    file_path: filePath,
    album: t.album ? { ...t.album, cover_url: albumCoverUrl } : null,
  };
}

// Публичный — для списка «Похожие треки» на странице трека.
router.get('/similar/track/:id', async (req: Request, res: Response) => {
  const trackId = parseInt(req.params.id as string);
  const limit = Math.max(1, Math.min(parseInt(String(req.query.limit || '10')) || 10, 50));
  if (!Number.isFinite(trackId)) return res.status(400).json({ error: 'bad track id' });

  const r = await aiFetch(`/recsys/similar/track/${trackId}?limit=${limit}`);
  if (r.status !== 200) return res.status(r.status).json(r.data);

  const tracks = Array.isArray(r.data?.tracks) ? r.data.tracks.map(normalizeTrack) : [];
  res.json({ ...r.data, tracks });
});

// Админ — состояние индекса.
router.get(
  '/index/stats',
  authenticateToken,
  authorizeRole(['admin', 'moderator']),
  async (_req: AuthRequest, res: Response) => {
    const r = await aiFetch('/recsys/index/stats');
    res.status(r.status).json(r.data);
  },
);

// Админ — принудительный пересбор.
router.post(
  '/index/rebuild',
  authenticateToken,
  authorizeRole(['admin', 'moderator']),
  async (_req: AuthRequest, res: Response) => {
    const r = await aiFetch('/recsys/index/rebuild', { method: 'POST' });
    res.status(r.status).json(r.data);
  },
);

// Item-CF (Phase 4 lite) — admin only
router.get('/cf/stats', authenticateToken, authorizeRole(['admin', 'moderator']),
  async (_req: AuthRequest, res: Response) => {
    const r = await aiFetch('/recsys/cf/stats');
    res.status(r.status).json(r.data);
  });

router.post('/cf/rebuild', authenticateToken, authorizeRole(['admin', 'moderator']),
  async (_req: AuthRequest, res: Response) => {
    const r = await aiFetch('/recsys/cf/rebuild', { method: 'POST' });
    res.status(r.status).json(r.data);
  });

router.get('/cf/similar/:id', async (req: Request, res: Response) => {
  const trackId = parseInt(req.params.id as string);
  const limit = Math.max(1, Math.min(parseInt(String(req.query.limit || '10')) || 10, 50));
  if (!Number.isFinite(trackId)) return res.status(400).json({ error: 'bad track id' });
  const r = await aiFetch(`/recsys/cf/similar/${trackId}?limit=${limit}`);
  res.status(r.status).json(r.data);
});

// =============================================================================
// Feed (Daily Mix) — авторизованный
// =============================================================================
router.get('/feed', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const limit = Math.max(1, Math.min(parseInt(String(req.query.limit || '50')) || 50, 100));
  const r = await aiFetch(`/recsys/feed?user_id=${userId}&limit=${limit}`);
  if (r.status !== 200) return res.status(r.status).json(r.data);

  const tracks = Array.isArray(r.data?.tracks) ? r.data.tracks.map(normalizeTrack) : [];
  res.json({ ...r.data, tracks });
});

// =============================================================================
// Feedback (нравится / не нравится / не показывать) — авторизованный
// =============================================================================
router.post('/feedback', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { target_type, target_id, score, reason } = req.body || {};
  if (!['track', 'artist', 'genre'].includes(String(target_type))) {
    return res.status(400).json({ error: 'bad target_type' });
  }
  const tid = parseInt(String(target_id));
  const sc = parseInt(String(score));
  if (!Number.isFinite(tid) || tid < 1) return res.status(400).json({ error: 'bad target_id' });
  if (![+1, -1, -2].includes(sc)) return res.status(400).json({ error: 'bad score' });

  const r = await aiFetch('/recsys/feedback', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      target_type,
      target_id: tid,
      score: sc,
      reason: reason || null,
    }),
  });
  res.status(r.status).json(r.data);
});

// =============================================================================
// Profile rebuild — пользователь может перестроить свой профиль (cooldown 30s)
// =============================================================================
const lastRebuildAt = new Map<number, number>();
const REBUILD_COOLDOWN_MS = 30 * 1000;

router.post('/profile/rebuild', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const last = lastRebuildAt.get(userId) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < REBUILD_COOLDOWN_MS) {
    return res.status(429).json({
      error: 'cooldown',
      retry_after_ms: REBUILD_COOLDOWN_MS - elapsed,
    });
  }
  lastRebuildAt.set(userId, Date.now());

  const r = await aiFetch(`/recsys/profile/rebuild?user_id=${userId}`, { method: 'POST' });
  res.status(r.status).json(r.data);
});

router.get('/profile/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const r = await aiFetch(`/recsys/profile/${userId}`);
  res.status(r.status).json(r.data);
});

export default router;
