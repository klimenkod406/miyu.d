/**
 * Прокси к ai-service (Phase 0).
 *
 * - POST   /api/ai/tracks/:id/analyze         — синхронный прогон (только admin/moderator).
 * - POST   /api/ai/tracks/:id/analyze/enqueue — поставить задачу в RQ-очередь.
 * - GET    /api/ai/tracks/:id                  — отдать результат анализа из БД.
 * - POST   /api/ai/cover/moderate              — NSFW-скор для произвольной обложки.
 * - GET    /api/ai/health                      — пинг ai-service.
 *
 * AI_SERVICE_URL берётся из env (по умолчанию http://localhost:8001).
 */
import { Router, Response } from 'express';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/auth';
import { getOne } from '../db';

const router = Router();

const AI_BASE = (process.env.AI_SERVICE_URL || 'http://localhost:8001').replace(/\/$/, '');

async function aiFetch(path: string, init?: RequestInit): Promise<Response | { status: number; data: any }> {
  const url = `${AI_BASE}${path}`;
  try {
    const r = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers as any) },
    });
    const text = await r.text();
    let data: any;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: r.status, data } as any;
  } catch (e: any) {
    return { status: 502, data: { error: 'ai-service unreachable', detail: e?.message } } as any;
  }
}

router.get('/health', async (_req, res) => {
  const r = await aiFetch('/health') as any;
  res.status(r.status).json(r.data);
});

router.post(
  '/tracks/:id/analyze',
  authenticateToken,
  authorizeRole(['admin', 'moderator']),
  async (req: AuthRequest, res: Response) => {
    const trackId = parseInt(req.params.id as string);
    if (!Number.isFinite(trackId)) return res.status(400).json({ error: 'bad track id' });
    const r = await aiFetch('/analyze', {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId }),
    }) as any;
    res.status(r.status).json(r.data);
  }
);

router.post(
  '/tracks/:id/analyze/enqueue',
  authenticateToken,
  authorizeRole(['admin', 'moderator', 'artist']),
  async (req: AuthRequest, res: Response) => {
    const trackId = parseInt(req.params.id as string);
    if (!Number.isFinite(trackId)) return res.status(400).json({ error: 'bad track id' });

    // Артист может ставить только свои треки.
    if (req.user!.role === 'artist') {
      const own = await getOne<any>('SELECT artist_id FROM tracks WHERE id = ?', [trackId]);
      if (!own || own.artist_id !== req.user!.id) {
        return res.status(403).json({ error: 'forbidden' });
      }
    }

    const r = await aiFetch('/analyze/enqueue', {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId }),
    }) as any;
    res.status(r.status).json(r.data);
  }
);

router.get('/tracks/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const trackId = parseInt(req.params.id as string);
  if (!Number.isFinite(trackId)) return res.status(400).json({ error: 'bad track id' });
  const r = await aiFetch(`/track/${trackId}`) as any;
  res.status(r.status).json(r.data);
});

router.get('/tracks/:id/lyrics', authenticateToken, async (req: AuthRequest, res: Response) => {
  const trackId = parseInt(req.params.id as string);
  if (!Number.isFinite(trackId)) return res.status(400).json({ error: 'bad track id' });
  const r = await aiFetch(`/track/${trackId}/lyrics`) as any;
  res.status(r.status).json(r.data);
});

router.post(
  '/cover/moderate',
  authenticateToken,
  authorizeRole(['admin', 'moderator']),
  async (req: AuthRequest, res: Response) => {
    const { image_path } = req.body || {};
    if (!image_path) return res.status(400).json({ error: 'image_path required' });
    const r = await aiFetch('/moderate/cover', {
      method: 'POST',
      body: JSON.stringify({ image_path }),
    }) as any;
    res.status(r.status).json(r.data);
  }
);

export default router;
