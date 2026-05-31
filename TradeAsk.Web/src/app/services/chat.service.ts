import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface ChatSession {
  id: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_type: string;
  file_path: string | null;
  file_type: string | null;
  is_expert_reviewed: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private baseUrl = environment.apiUrl;

  getSessionToken(): string | null {
    return localStorage.getItem('tradeask_session_token');
  }

  setSessionToken(token: string) {
    localStorage.setItem('tradeask_session_token', token);
  }

  getStoredEmail(): string | null {
    return localStorage.getItem('tradeask_email');
  }

  setStoredEmail(email: string) {
    localStorage.setItem('tradeask_email', email);
  }

  async createSession(email: string, category: string): Promise<{ sessionId: string; sessionToken: string }> {
    const res = await fetch(`${this.baseUrl}/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, category }),
    });
    if (!res.ok) throw new Error('Failed to create session');
    const data = await res.json();
    this.setSessionToken(data.sessionToken);
    this.setStoredEmail(email);
    return data;
  }

  async getSessions(): Promise<ChatSession[]> {
    const token = this.getSessionToken();
    if (!token) return [];
    const res = await fetch(`${this.baseUrl}/chat/sessions`, {
      headers: { 'x-session-token': token },
    });
    if (!res.ok) return [];
    return res.json();
  }

  async getSession(id: string): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
    const token = this.getSessionToken();
    const res = await fetch(`${this.baseUrl}/chat/sessions/${id}`, {
      headers: { 'x-session-token': token || '' },
    });
    if (!res.ok) throw new Error('Failed to fetch session');
    return res.json();
  }

  async discardSession(id: string): Promise<void> {
    const token = this.getSessionToken();
    const res = await fetch(`${this.baseUrl}/chat/sessions/${id}`, {
      method: 'DELETE',
      headers: { 'x-session-token': token || '' },
    });
    if (!res.ok) throw new Error('Failed to discard session');
  }

  async identifyByEmail(email: string): Promise<string | null> {
    const res = await fetch(`${this.baseUrl}/chat/identify?email=${encodeURIComponent(email)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.found) {
      this.setSessionToken(data.sessionToken);
      this.setStoredEmail(email);
      return data.sessionToken;
    }
    return null;
  }

  async *streamMessage(content: string, file?: File): AsyncGenerator<{ type: string; data: any }> {
    const token = this.getSessionToken();
    if (!token) throw new Error('No session token');

    const formData = new FormData();
    formData.append('content', content);
    formData.append('sessionToken', token);
    if (file) formData.append('file', file);

    const res = await fetch(`${this.baseUrl}/chat/message`, {
      method: 'POST',
      headers: { 'x-session-token': token },
      body: formData,
    });

    if (!res.ok) {
      throw new Error('Failed to send message');
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7);
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            yield { type: currentEvent || 'token', data: parsed };
          } catch {}
        }
      }
    }
  }
}
