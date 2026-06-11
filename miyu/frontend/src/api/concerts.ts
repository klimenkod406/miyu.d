
const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
  });

  const text = await response.text();
  if (!response.ok) {
    // Attempt to parse error message from server
    try {
        const errJson = JSON.parse(text);
        throw new Error(errJson.error || 'Request failed');
    } catch {
        throw new Error(text || 'Request failed');
    }
  }

  return text ? JSON.parse(text) : (null as any);
}

export const concertsApi = {
  // PUBLIC
  getAll: async () => {
    return request<any[]>('/concerts');
  },
  getById: async (id: string | number) => {
    return request<any>(`/concerts/${id}`);
  },
  getBanner: async () => {
    return request<any[]>('/concerts/banner');
  },

  // USER
  buyTicket: async (accessToken: string, concertId: number, ticket_type_id: number, quantity: number) => {
    return request<any>(`/concerts/${concertId}/buy-ticket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ticket_type_id, quantity })
    });
  },
  getMyTickets: async (accessToken: string) => {
    return request<any[]>('/user/me/tickets', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
  getTicketById: async (accessToken: string, ticketId: string) => {
    return request<any>(`/user/me/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
  getTicketsForUserConcert: async (accessToken: string, concertId: string | number) => {
    return request<{ concert: any; tickets: any[] }>(`/user/me/tickets/concert/${concertId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  // ARTIST
  getArtistConcerts: async (accessToken: string) => {
    return request<any>('/artist/concerts', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
  
  // ADMIN / ARTIST
  create: async (accessToken: string, concertData: {
    title: string
    description?: string
    venue?: string
    city?: string
    country?: string
    address?: string
    datetime: string
    time?: string
    venue_plan_id?: string
    cover?: File | null
    ticket_types: Array<{ name: string; price: number; quantity: number; zone_id?: string }>
    co_artist_ids?: number[]
  }) => {
    const fd = new FormData();
    fd.append('title', concertData.title);
    if (concertData.description) fd.append('description', concertData.description);
    if (concertData.venue) fd.append('venue', concertData.venue);
    if (concertData.city) fd.append('city', concertData.city);
    if (concertData.country) fd.append('country', concertData.country);
    if (concertData.address) fd.append('address', concertData.address);
    fd.append('datetime', concertData.datetime);
    if (concertData.time) fd.append('time', concertData.time);
    if (concertData.venue_plan_id) fd.append('venue_plan_id', concertData.venue_plan_id);
    fd.append('ticket_types', JSON.stringify(concertData.ticket_types));
    if (concertData.co_artist_ids && concertData.co_artist_ids.length > 0) {
      fd.append('co_artist_ids', JSON.stringify(concertData.co_artist_ids));
    }
    if (concertData.cover) fd.append('cover', concertData.cover);

    return request<any>('/concerts', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: fd
    });
  },
  updateCoArtists: async (accessToken: string, concertId: number, co_artist_ids: number[]) => {
    return request<any>(`/concerts/${concertId}/co-artists`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ co_artist_ids }),
    });
  },
  searchArtists: async (accessToken: string, query: string) => {
    return request<Array<{ id: number; username: string; avatar_url?: string | null }>>(
      `/artist/search?q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  },
  update: async (accessToken: string, id: number, concertData: any) => {
    return request<any>(`/concerts/${id}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(concertData)
    });
  },
  delete: async (accessToken: string, id: number) => {
    return request<any>(`/concerts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
    });
  },
  getTicketsForConcert: async (accessToken: string, id: number) => {
    return request<any[]>(`/concerts/${id}/tickets`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
  addToBanner: async (accessToken: string, id: number) => {
    return request<any>(`/concerts/banner/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
    });
  },
  removeFromBanner: async (accessToken: string, id: number) => {
    return request<any>(`/concerts/banner/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
    });
  }
};
