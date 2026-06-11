const API_BASE = '/api';

interface AuthResponse {
  user: {
    id: number;
    email: string;
    username: string;
    role: string;
    avatar_url: string | null;
    bio: string | null;
    is_verified: boolean;
    is_premium: boolean;
    premium_expires_at: string | null;
    palette_mode?: string;
    palette_primary?: string;
    palette_secondary?: string;
    palette_tertiary?: string;
    palette_accent?: string;
  };
  accessToken: string;
  refreshToken: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  is_premium: boolean;
  premium_expires_at: string | null;
  created_at?: string;
  palette_mode?: string;
  palette_primary?: string;
  palette_secondary?: string;
  palette_tertiary?: string;
  palette_accent?: string;
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

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logout: async (refreshToken: string): Promise<void> => {
    return request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  refresh: async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
    return request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  me: async (accessToken: string): Promise<AuthResponse['user']> => {
    return request<AuthResponse['user']>('/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  },

  updateMe: async (data: { username?: string; bio?: string; avatar_url?: string }): Promise<AuthResponse['user']> => {
    const tokens = getStoredTokens();
    if (!tokens) throw new Error('Not authenticated');

    return request<AuthResponse['user']>('/user/me', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify(data),
    });
  },

  updateUserRole: async (userId: number, role: string): Promise<{ message: string }> => {
    const tokens = getStoredTokens();
    if (!tokens) throw new Error('Not authenticated');

    return request<{ message: string }>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify({ role }),
    });
  },

  getUsers: async (accessToken: string): Promise<User[]> => {
    return request<User[]>('/admin/users', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getArtists: async (accessToken: string): Promise<User[]> => {
    return request<User[]>('/admin/artists', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getArtistApplication: async (accessToken: string): Promise<any> => {
    return request<any>('/user/me/artist-application', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  submitArtistApplication: async (accessToken: string, payload: { type?: 'create' | 'delete'; message?: string; links?: string; reason?: string; password?: string }): Promise<any> => {
    return request<any>('/user/me/artist-application', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    });
  },

  getArtistApplications: async (accessToken: string): Promise<any[]> => {
    return request<any[]>('/admin/artist-applications', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  reviewArtistApplication: async (accessToken: string, applicationId: number, status: 'approved' | 'rejected'): Promise<{ message: string }> => {
    return request<{ message: string }>(`/admin/artist-applications/${applicationId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ status }),
    });
  },

  uploadArtistAvatar: async (accessToken: string, userId: number, file: File): Promise<{ avatar_url: string; username: string }> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await fetch(`${API_BASE}/admin/artists/${userId}/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return response.json();
  },
};

export function getStoredTokens(): { accessToken: string; refreshToken: string } | null {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

export function storeTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}
