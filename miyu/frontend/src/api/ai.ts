const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || 'Request failed');
  return text ? JSON.parse(text) : (null as any);
}

export interface AITrackAnalysis {
  track_id: number;
  ai_score: number | null;
  ai_flags: string[];
  mood_tags: string[];
  genre_tags: Array<{ tag: string; prob: number }>;
  bpm: number | null;
  key: string | null;
  danceability: number | null;
  energy: number | null;
  valence: number | null;
  acousticness: number | null;
  instrumentalness: number | null;
  speechiness: number | null;
  loudness: number | null;
  fingerprint: string | null;
  analysis_version: string | null;
  lyrics_language: string | null;
  analysis_summary: string | null;
  updated_at: string | null;
  created_at: string | null;
}

export const aiApi = {
  /** Получить сохранённый анализ трека из БД (через ai-service). */
  getTrackAnalysis: (accessToken: string, trackId: number) =>
    request<AITrackAnalysis>(`/ai/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  /** Поставить задачу анализа в очередь RQ. */
  enqueueAnalyze: (accessToken: string, trackId: number) =>
    request<{ job_id: string; queue: string; track_id: number }>(
      `/ai/tracks/${trackId}/analyze/enqueue`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
    ),

  /** Синхронный прогон (для отладки). */
  analyzeSync: (accessToken: string, trackId: number) =>
    request<any>(`/ai/tracks/${trackId}/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  /** Получить lyrics с разметкой explicit-слов и segments. */
  getTrackLyrics: (accessToken: string, trackId: number) =>
    request<{
      track_id: number;
      lyrics_text: string;
      lyrics_language: string | null;
      explicit_words: Array<{ start: number; end: number; word: string }>;
      segments: Array<{ start: number; end: number; text: string }>;
      structure: Array<{ start: number; end: number; label: string; type: string }>;
      analysis_version: string | null;
    }>(`/ai/tracks/${trackId}/lyrics`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  health: () => request<{ status: string }>(`/ai/health`),
};
