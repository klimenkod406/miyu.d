const API_BASE = '/api';

export interface AdminBatchUploadResult {
  originalFileName: string;
  status: 'imported' | 'duplicate' | 'invalid_name' | 'unsupported_type' | 'artist_not_found' | 'failed';
  artistName?: string;
  artistId?: number;
  title?: string;
  trackId?: number;
  filePath?: string;
  aiQueued?: boolean;
  aiJobId?: string;
  error?: string;
}

export interface AdminBatchUploadResponse {
  summary: {
    received: number;
    imported: number;
    duplicates: number;
    failed: number;
    aiQueued: number;
  };
  results: AdminBatchUploadResult[];
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || 'Request failed');
  }

  return text ? JSON.parse(text) : (null as any);
}

export const adminApi = {
  getStats: async (accessToken: string) => {
    return request<any>('/moderation/stats', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getCharts: async (accessToken: string, days: number = 30) => {
    return request<any>(`/moderation/charts?days=${days}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getPendingTracks: async (accessToken: string, filters: { status?: string; flag?: string; sort?: string; q?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.flag) params.set('flag', filters.flag);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.q) params.set('q', filters.q);
    const qs = params.toString();
    return request<any[]>(`/moderation/tracks/pending${qs ? '?' + qs : ''}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getApprovedTracks: async (accessToken: string, filters: { q?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    const qs = params.toString();
    return request<any[]>(`/moderation/tracks/approved${qs ? '?' + qs : ''}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getTrackCounts: async (accessToken: string) => {
    return request<{ all: number; pending: number; ai_flagged: number; flags: Record<string, number> }>(
      '/moderation/tracks/counts',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  },

  getTrackHistory: async (accessToken: string, trackId: number) => {
    return request<{ track_id: number; events: any[] }>(
      `/moderation/tracks/${trackId}/history`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  },

  uploadTrackBatch: async (accessToken: string, formData: FormData): Promise<AdminBatchUploadResponse> => {
    const response = await fetch(`${API_BASE}/admin/tracks/batch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    const text = await response.text();
    if (!response.ok) {
      let message = text || 'Batch upload failed';
      try {
        const parsed = text ? JSON.parse(text) : null;
        if (parsed?.error) message = parsed.error;
      } catch {
        // Keep raw text for non-JSON errors.
      }
      throw new Error(message);
    }

    return text ? JSON.parse(text) : { summary: { received: 0, imported: 0, duplicates: 0, failed: 0, aiQueued: 0 }, results: [] };
  },

  approveTrack: async (accessToken: string, trackId: number, comment?: string) => {
    return request<any>(`/moderation/tracks/${trackId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ comment: comment || '' }),
    });
  },

  rejectTrack: async (accessToken: string, trackId: number, comment?: string) => {
    return request<any>(`/moderation/tracks/${trackId}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ comment: comment || '' }),
    });
  },

  getPendingAlbums: async (accessToken: string) => {
    return request<any[]>('/moderation/albums/pending', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getAlbumTracks: async (accessToken: string, albumId: number) => {
    return request<any[]>(`/moderation/albums/${albumId}/tracks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  approveAlbum: async (accessToken: string, albumId: number) => {
    return request<any>(`/moderation/albums/${albumId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  rejectAlbum: async (accessToken: string, albumId: number) => {
    return request<any>(`/moderation/albums/${albumId}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getPendingConcerts: async (accessToken: string) => {
    return request<any[]>('/moderation/concerts/pending', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  approveConcert: async (accessToken: string, concertId: number) => {
    return request<any>(`/moderation/concerts/${concertId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  rejectConcert: async (accessToken: string, concertId: number) => {
    return request<any>(`/moderation/concerts/${concertId}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getPendingVideos: async (accessToken: string) => {
    return request<any[]>('/moderation/videos/pending', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  approveVideo: async (accessToken: string, videoId: number) => {
    return request<any>(`/moderation/videos/${videoId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  rejectVideo: async (accessToken: string, videoId: number) => {
    return request<any>(`/moderation/videos/${videoId}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
};
