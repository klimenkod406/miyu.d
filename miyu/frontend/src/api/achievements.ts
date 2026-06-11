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

export const achievementsApi = {
  getAll: async () => {
    return request<any[]>('/achievements');
  },

  getUserAchievements: async (accessToken: string) => {
    return request<any[]>('/achievements', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  },

  getUserAchievementsWithSecrets: async (accessToken: string) => {
    return request<any[]>('/user/achievements', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  },

  getShowcase: async (accessToken: string) => {
    return request<any[]>('/user/achievements/showcase', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  },

  updateShowcase: async (accessToken: string, achievementIds: number[]) => {
    return request<any>('/achievements/showcase', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ achievementIds }),
    });
  },

  getAdminAchievements: async (accessToken: string) => {
    return request<any[]>('/admin/achievements', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  },

  createAchievement: async (accessToken: string, data: {
    code: string;
    title: string;
    description?: string;
    icon?: string;
    requirement_type: string;
    requirement_value: number;
  }) => {
    return request<any>('/admin/achievements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
    });
  },

  updateAchievement: async (
    accessToken: string,
    id: number,
    data: {
      code?: string;
      title?: string;
      description?: string;
      icon?: string;
      requirement_type?: string;
      requirement_value?: number;
    }
  ) => {
    return request<any>(`/admin/achievements/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
    });
  },

  deleteAchievement: async (accessToken: string, id: number) => {
    return request<any>(`/admin/achievements/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  },
};