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

export interface SimilarTrack {
  id: number;
  title: string;
  duration: number;
  cover_url: string | null;
  file_path: string | null;
  artist_id: number;
  artist: {
    id: number;
    username: string;
    is_verified: boolean;
  };
  album: {
    id: number;
    title: string;
    cover_url: string | null;
  } | null;
  similarity: number;
}

export interface SimilarResponse {
  track_id: number;
  tracks: SimilarTrack[];
  cached: boolean;
  index_size?: number;
  reason?: string; // when tracks=[]
}

// ---------------- Feed (Daily Mix) ----------------

export interface FeedTrack extends SimilarTrack {
  score: number;
}

export interface FeedResponse {
  user_id: number;
  mode: 'content_based' | 'popularity';
  interactions_count: number;
  profile_version: string | null;
  tracks: FeedTrack[];
  cached: boolean;
}

// ---------------- Profile ----------------

export interface ProfileResponse {
  user_id: number;
  has_centroid: boolean;
  interactions_count: number;
  profile_version: string | null;
  top_genres: { tag: string; weight: number }[];
  top_moods: { tag: string; weight: number }[];
  bpm_mean: number | null;
  bpm_std: number | null;
  energy_mean: number | null;
  valence_mean: number | null;
  danceability_mean: number | null;
  diversity: number | null;
  updated_at: string | null;
}

export interface PersonalizedHomeArtist {
  id: number;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  is_premium: boolean;
  reason: string;
  listened_seconds?: number;
  genre?: string | null;
}

export interface PersonalizedHomePlaylist {
  id: number;
  title: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  is_system: boolean;
  is_pinned: boolean;
  track_count: number;
  kind: 'mood' | 'daily';
  slot_key: string;
}

export interface PersonalizedHomeResponse {
  generated_for: string;
  featured_artists: PersonalizedHomeArtist[];
  mood_playlists: PersonalizedHomePlaylist[];
  playlist_of_day: PersonalizedHomePlaylist | null;
}

export type FeedbackTargetType = 'track' | 'artist' | 'genre';
export type FeedbackScore = 1 | -1 | -2; // like / dislike / do-not-show

export const recsysApi = {
  getSimilarTracks: (trackId: number, limit = 10): Promise<SimilarResponse> =>
    request(`/recsys/similar/track/${trackId}?limit=${limit}`),

  // -------- Feed --------
  getFeed: (accessToken: string, limit = 50): Promise<FeedResponse> =>
    request(`/recsys/feed?limit=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  // -------- Feedback --------
  sendFeedback: (
    accessToken: string,
    args: { target_type: FeedbackTargetType; target_id: number; score: FeedbackScore; reason?: string },
  ): Promise<{ ok: boolean }> =>
    request('/recsys/feedback', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(args),
    }),

  // -------- Profile --------
  rebuildMyProfile: (accessToken: string): Promise<{
    ok: boolean; user_id: number; interactions_count: number; has_centroid: boolean;
    diversity: number | null; top_genres: any[]; top_moods: any[];
  }> =>
    request('/recsys/profile/rebuild', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  getMyProfile: (accessToken: string): Promise<ProfileResponse> =>
    request('/recsys/profile/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  getPersonalizedHome: (accessToken: string): Promise<PersonalizedHomeResponse> =>
    request('/home/personalized', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  // -------- admin --------
  getIndexStats: (accessToken: string) =>
    request<{ size: number; dim: number; built_at: number; ttl_seconds: number }>(
      '/recsys/index/stats',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ),

  rebuildIndex: (accessToken: string) =>
    request<{ ok: boolean; size: number }>(
      '/recsys/index/rebuild',
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
    ),

  getCfStats: (accessToken: string) =>
    request<{ size: number; n_users: number; built_at: number; snapshot_path: string; exists: boolean }>(
      '/recsys/cf/stats',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ),

  rebuildCf: (accessToken: string) =>
    request<{ ok: boolean; size: number; n_users: number; built_at: number }>(
      '/recsys/cf/rebuild',
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
    ),
};
