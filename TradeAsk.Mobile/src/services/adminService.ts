import { API_URL } from './config';
import { authStorage } from './authStorage';
import type { Question, AdminStats, Expert } from '../types/admin';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await authStorage.getAdminToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const adminService = {
  async login(email: string, password: string): Promise<{ token: string; email: string; role: string }> {
    const res = await fetch(`${API_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    await authStorage.setAdminToken(data.token);
    await authStorage.setAdminEmail(email);
    if (data.role) await authStorage.setAdminRole(data.role);
    return data;
  },

  async signup(data: { email: string; password: string; name: string; specialty: string }): Promise<void> {
    const res = await fetch(`${API_URL}/admin/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Signup failed' }));
      throw new Error(err.error || 'Signup failed');
    }
  },

  async firebaseLogin(idToken: string): Promise<{ token: string; email: string; role: string }> {
    const res = await fetch(`${API_URL}/admin/firebase-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new Error('Firebase login failed');
    const data = await res.json();
    await authStorage.setAdminToken(data.token);
    await authStorage.setAdminEmail(data.email);
    if (data.role) await authStorage.setAdminRole(data.role);
    return data;
  },

  async getStats(): Promise<AdminStats> {
    const res = await fetch(`${API_URL}/admin/stats`, { headers: await authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async getQuestions(status?: string): Promise<Question[]> {
    const params = status ? `?status=${status}` : '';
    const res = await fetch(`${API_URL}/admin/questions${params}`, { headers: await authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch questions');
    return res.json();
  },

  async getQuestion(id: number): Promise<Question> {
    const res = await fetch(`${API_URL}/admin/questions/${id}`, { headers: await authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch question');
    return res.json();
  },

  async approveQuestion(id: number, data: { finalAnswer: string; correctionNeeded: boolean; correctionNotes?: string; addedToKb: boolean }): Promise<void> {
    const res = await fetch(`${API_URL}/admin/questions/${id}/approve`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to approve question');
  },

  async escalateQuestion(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/admin/questions/${id}/escalate`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Failed to escalate question');
  },

  async routeToExpert(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/admin/questions/${id}/route-to-expert`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Failed to route to expert');
  },

  async getExperts(): Promise<Expert[]> {
    const res = await fetch(`${API_URL}/admin/experts`, { headers: await authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch experts');
    return res.json();
  },

  async approveExpert(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/admin/experts/${id}/approve`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Failed to approve expert');
  },

  async rejectExpert(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/admin/experts/${id}/reject`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Failed to reject expert');
  },
};
