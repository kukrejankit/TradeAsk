import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authStorage } from '../services/authStorage';
import { chatService } from '../services/chatService';
import type { ChatSession } from '../types/chat';

interface ChatState {
  email: string | null;
  sessionToken: string | null;
  sessions: ChatSession[];
  currentSessionId: string | null;
  identified: boolean;
  loading: boolean;
}

interface ChatContextValue extends ChatState {
  identify: (email: string) => Promise<boolean>;
  createSession: (email: string, category: string) => Promise<string>;
  loadSessions: () => Promise<void>;
  setCurrentSession: (id: string | null) => void;
  deleteSession: (id: string) => Promise<void>;
  logout: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ChatState>({
    email: null,
    sessionToken: null,
    sessions: [],
    currentSessionId: null,
    identified: false,
    loading: true,
  });

  useEffect(() => {
    (async () => {
      const [token, email] = await Promise.all([
        authStorage.getSessionToken(),
        authStorage.getEmail(),
      ]);
      setState(s => ({
        ...s,
        sessionToken: token,
        email,
        identified: !!token,
        loading: false,
      }));
    })();
  }, []);

  const loadSessions = useCallback(async () => {
    const sessions = await chatService.getSessions();
    setState(s => ({ ...s, sessions }));
  }, []);

  const identify = useCallback(async (email: string): Promise<boolean> => {
    const token = await chatService.identifyByEmail(email);
    if (token) {
      setState(s => ({ ...s, email, sessionToken: token, identified: true }));
      return true;
    }
    return false;
  }, []);

  const createSession = useCallback(async (email: string, category: string): Promise<string> => {
    const { sessionId, sessionToken } = await chatService.createSession(email, category);
    setState(s => ({ ...s, email, sessionToken, identified: true, currentSessionId: sessionId }));
    return sessionId;
  }, []);

  const setCurrentSession = useCallback((id: string | null) => {
    setState(s => ({ ...s, currentSessionId: id }));
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    await chatService.deleteSession(id);
    setState(s => ({
      ...s,
      sessions: s.sessions.filter(sess => sess.id !== id),
      currentSessionId: s.currentSessionId === id ? null : s.currentSessionId,
    }));
  }, []);

  const logout = useCallback(async () => {
    await authStorage.clearChat();
    setState({
      email: null,
      sessionToken: null,
      sessions: [],
      currentSessionId: null,
      identified: false,
      loading: false,
    });
  }, []);

  return (
    <ChatContext.Provider value={{ ...state, identify, createSession, loadSessions, setCurrentSession, deleteSession, logout }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
