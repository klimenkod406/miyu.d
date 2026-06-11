const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
  });

  const text = await response.text();
  if (!response.ok) {
    try {
      const errJson = JSON.parse(text);
      throw new Error(errJson.error || 'Request failed');
    } catch {
      throw new Error(text || 'Request failed');
    }
  }

  return text ? JSON.parse(text) : (null as any);
}

export interface SearchResults {
  tracks: Array<{
    id: number;
    title: string;
    duration: number;
    file_path: string;
    cover_url: string | null;
    genre: string | null;
    is_explicit: number;
    is_premium: number;
    artist: {
      id: number;
      username: string;
      is_verified: number;
      is_premium: number;
    };
    album: {
      id: number;
      title: string;
      cover_url: string | null;
    } | null;
  }>;
  artists: Array<{
    id: number;
    name: string;
    avatar_url: string | null;
    bio: string | null;
    is_verified: number;
    is_premium: number;
    track_count: number;
  }>;
  albums: Array<{
    id: number;
    title: string;
    cover_url: string | null;
    release_year: number;
    track_count: number;
    artist: {
      id: number;
      username: string;
      is_verified: number;
    };
  }>;
  playlists: Array<{
    id: number;
    title: string;
    cover_url: string | null;
    is_public: number;
    track_count: number;
    author: {
      id: number;
      username: string;
    };
  }>;
  concerts: Array<{
    id: number;
    title: string;
    event_date: string;
    event_time: string | null;
    venue: string;
    city: string;
    cover_url: string | null;
    status: string;
    price: number;
    artist: {
      id: number;
      username: string;
    };
  }>;
}

export const searchApi = {
  search: async (
    accessToken: string,
    query: string,
    type?: 'all' | 'tracks' | 'artists' | 'albums' | 'playlists' | 'concerts',
    genre?: string,
  ): Promise<SearchResults> => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (genre) params.set('genre', genre);
    if (type && type !== 'all') {
      params.append('type', type);
    }
    return request<SearchResults>(`/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
};
