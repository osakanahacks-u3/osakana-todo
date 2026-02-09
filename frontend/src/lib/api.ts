const API_BASE = (import.meta as any).env?.PUBLIC_API_URL || '';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

function setToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

function removeToken(): void {
  localStorage.removeItem('auth_token');
}

async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    removeToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Request failed');
  }

  // ファイルダウンロードの場合
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('text/plain') || contentType?.includes('text/csv')) {
    return response.text();
  }

  return response.json();
}

// 認証
export const auth = {
  async loginWithPassword(password: string) {
    const data = await fetchApi('/api/auth/login/password', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    setToken(data.token);
    return data;
  },

  async getDiscordAuthUrl() {
    return fetchApi('/api/auth/discord');
  },

  async loginWithDiscord(code: string) {
    const data = await fetchApi('/api/auth/discord/callback', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
    setToken(data.token);
    return data;
  },

  async checkSession() {
    try {
      return await fetchApi('/api/auth/session');
    } catch {
      return null;
    }
  },

  async logout() {
    try {
      await fetchApi('/api/auth/logout', { method: 'POST' });
    } finally {
      removeToken();
    }
  },

  isLoggedIn() {
    return !!getToken();
  },

  async getConfig() {
    return fetchApi('/api/auth/config');
  }
};

// タスク
export const tasks = {
  async getAll(filters: Record<string, any> = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const query = params.toString();
    return fetchApi(`/api/tasks${query ? `?${query}` : ''}`);
  },

  async getMy(filters: { priority?: string; assignedType?: string; status?: string } = {}) {
    const params = new URLSearchParams();
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.assignedType) params.append('assignedType', filters.assignedType);
    if (filters.status) params.append('status', filters.status);
    const query = params.toString();
    return fetchApi(`/api/tasks/my${query ? `?${query}` : ''}`);
  },

  async getStats() {
    return fetchApi('/api/tasks/stats');
  },

  async get(id: string) {
    return fetchApi(`/api/tasks/${id}`);
  },

  async create(data: {
    title: string;
    description?: string;
    priority?: string;
    dueDate?: string;
    assignedType?: string;
    assignedUserIds?: string[];
    assignedUserId?: string;
    assignedGroupId?: string;
  }) {
    return fetchApi('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async update(id: string, data: Record<string, any>) {
    return fetchApi(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async delete(id: string) {
    return fetchApi(`/api/tasks/${id}`, { method: 'DELETE' });
  },

  async addComment(id: string, content: string) {
    return fetchApi(`/api/tasks/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  }
};

// グループ
export const groups = {
  async getAll() {
    return fetchApi('/api/groups');
  },

  async get(id: string) {
    return fetchApi(`/api/groups/${id}`);
  },

  async create(data: { name: string; description?: string; color?: string }) {
    return fetchApi('/api/groups', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async update(id: string, data: Record<string, any>) {
    return fetchApi(`/api/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async delete(id: string) {
    return fetchApi(`/api/groups/${id}`, { method: 'DELETE' });
  },

  async addMember(groupId: string, userId: string) {
    return fetchApi(`/api/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  async removeMember(groupId: string, userId: string) {
    return fetchApi(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
  }
};

// ユーザー
export const users = {
  async getAll() {
    return fetchApi('/api/users');
  },

  async get(id: string) {
    return fetchApi(`/api/users/${id}`);
  }
};

// エクスポート
export const exportTasks = {
  async asTxt(filters: Record<string, any> = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const query = params.toString();
    return fetchApi(`/api/export/txt${query ? `?${query}` : ''}`);
  },

  async asCsv(filters: Record<string, any> = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const query = params.toString();
    return fetchApi(`/api/export/csv${query ? `?${query}` : ''}`);
  },

  async asJson(filters: Record<string, any> = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const query = params.toString();
    return fetchApi(`/api/export/json${query ? `?${query}` : ''}`);
  },

  downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
