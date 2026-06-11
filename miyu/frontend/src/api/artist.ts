const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || 'Request failed');
  }

  return text ? JSON.parse(text) : (null as any);
}

export const artistApi = {
  getTracks: async (accessToken: string) => {
    return request<any[]>('/artist/tracks', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  uploadTrack: async (accessToken: string, formData: FormData) => {
    const response = await fetch(`${API_BASE}/artist/tracks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || 'Upload failed');
    }
    return text ? JSON.parse(text) : null;
  },

  updateTrack: async (accessToken: string, trackId: number, data: any) => {
    return request<any>(`/artist/tracks/${trackId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  },

  deleteTrack: async (accessToken: string, trackId: number) => {
    return request<any>(`/artist/tracks/${trackId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getAlbums: async (accessToken: string) => {
    return request<any[]>('/artist/albums', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  createAlbum: async (accessToken: string, data: FormData) => {
    return request<any>('/artist/albums', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: data,
    });
  },

  updateAlbum: async (accessToken: string, albumId: number, data: any) => {
    return request<any>(`/artist/albums/${albumId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  },

  deleteAlbum: async (accessToken: string, albumId: number) => {
    return request<any>(`/artist/albums/${albumId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getStats: async (accessToken: string) => {
    return request<any>('/artist/stats', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getVideos: async (accessToken: string) => {
    return request<any[]>('/artist/videos', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  uploadVideo: async (accessToken: string, formData: FormData) => {
    const response = await fetch(`${API_BASE}/artist/videos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || 'Upload failed');
    }
    return text ? JSON.parse(text) : null;
  },

  updateVideo: async (accessToken: string, videoId: number, data: any) => {
    return request<any>(`/artist/videos/${videoId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  },

  deleteVideo: async (accessToken: string, videoId: number) => {
    return request<any>(`/artist/videos/${videoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getApprovedTracks: async (accessToken: string) => {
    return request<any[]>('/artist/approved-tracks', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getApprovedAlbums: async (accessToken: string) => {
    return request<any[]>('/artist/approved-albums', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
};