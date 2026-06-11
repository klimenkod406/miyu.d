/**
 * Тонкий клиент к ai-service. Используется для постановки задач анализа в очередь
 * после загрузки трека. Все вызовы fire-and-forget — отказ ai-service не должен
 * валить загрузку.
 */
const AI_BASE = (process.env.AI_SERVICE_URL || 'http://localhost:8001').replace(/\/$/, '');
const AI_ENABLED = (process.env.AI_SERVICE_ENABLED ?? 'true').toLowerCase() !== 'false';

export interface EnqueueResult {
  ok: boolean;
  job_id?: string;
  error?: string;
}

/**
 * Поставить задачу `analyze_track` в RQ-очередь ai-service.
 * Возвращает результат, но НЕ бросает исключений — клиентский код
 * должен лишь логировать ошибку.
 */
export async function enqueueAnalyzeTrack(trackId: number, filePath?: string): Promise<EnqueueResult> {
  if (!AI_ENABLED) return { ok: false, error: 'ai disabled' };
  try {
    const r = await fetch(`${AI_BASE}/analyze/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_id: trackId, file_path: filePath ?? null }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return { ok: false, error: `ai-service ${r.status}: ${text.slice(0, 200)}` };
    }
    const data: any = await r.json().catch(() => ({}));
    return { ok: true, job_id: data?.job_id };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' };
  }
}

/** Удобная обёртка: поставить и залогировать, без await на стороне вызова. */
export function enqueueAnalyzeTrackAndForget(trackId: number, filePath?: string): void {
  enqueueAnalyzeTrack(trackId, filePath)
    .then(r => {
      if (r.ok) console.log(`[ai] analyze enqueued track=${trackId} job=${r.job_id}`);
      else console.warn(`[ai] enqueue failed track=${trackId}: ${r.error}`);
    })
    .catch(e => console.warn(`[ai] enqueue exception track=${trackId}:`, e?.message || e));
}
