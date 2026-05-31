import { API_URL } from './config';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  submitQuestion(formData: FormData) {
    return request('/questions', { method: 'POST', body: formData });
  },

  getMyQuestions() {
    return request('/users/me/questions');
  },

  getMyProfile() {
    return request('/users/me');
  },

  savePushToken(token: string, platform: string) {
    return request('/users/me/push-token', {
      method: 'PUT',
      body: JSON.stringify({ token, platform }),
    });
  },
};
