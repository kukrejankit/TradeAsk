import { API_URL } from './config';
import { authStorage } from './authStorage';
import { parseSSEStream } from './sseParser';
import type { ChatSession, ChatMessage, StreamEvent } from '../types/chat';

export const chatService = {
  async createSession(email: string, category: string): Promise<{ sessionId: string; sessionToken: string }> {
    const res = await fetch(`${API_URL}/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, category }),
    });
    if (!res.ok) throw new Error('Failed to create session');
    const data = await res.json();
    await authStorage.setSessionToken(data.sessionToken);
    await authStorage.setEmail(email);
    return data;
  },

  async identifyByEmail(email: string): Promise<string | null> {
    const res = await fetch(`${API_URL}/chat/identify?email=${encodeURIComponent(email)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.found) {
      await authStorage.setSessionToken(data.sessionToken);
      await authStorage.setEmail(email);
      return data.sessionToken;
    }
    return null;
  },

  async getSessions(): Promise<ChatSession[]> {
    const token = await authStorage.getSessionToken();
    if (!token) return [];
    const res = await fetch(`${API_URL}/chat/sessions`, {
      headers: { 'x-session-token': token },
    });
    if (!res.ok) return [];
    return res.json();
  },

  async getSession(id: string): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
    const token = await authStorage.getSessionToken();
    const res = await fetch(`${API_URL}/chat/sessions/${id}`, {
      headers: { 'x-session-token': token || '' },
    });
    if (!res.ok) throw new Error('Failed to fetch session');
    return res.json();
  },

  async deleteSession(id: string): Promise<void> {
    const token = await authStorage.getSessionToken();
    const res = await fetch(`${API_URL}/chat/sessions/${id}`, {
      method: 'DELETE',
      headers: { 'x-session-token': token || '' },
    });
    if (!res.ok) throw new Error('Failed to delete session');
  },

  async *streamMessage(content: string, fileUri?: string, fileName?: string, fileType?: string): AsyncGenerator<StreamEvent> {
    const token = await authStorage.getSessionToken();
    if (!token) throw new Error('No session token');

    const formData = new FormData();
    formData.append('content', content);
    formData.append('sessionToken', token);

    if (fileUri && fileName) {
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: fileType || 'application/octet-stream',
      } as any);
    }

    const res = await fetch(`${API_URL}/chat/message`, {
      method: 'POST',
      headers: { 'x-session-token': token },
      body: formData,
    });

    if (!res.ok) throw new Error('Failed to send message');

    yield* parseSSEStream(res);
  },
};
