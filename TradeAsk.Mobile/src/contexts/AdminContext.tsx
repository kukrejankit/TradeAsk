import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authStorage } from '../services/authStorage';
import { adminService } from '../services/adminService';

interface AdminState {
  token: string | null;
  email: string | null;
  role: string | null;
  loggedIn: boolean;
  loading: boolean;
}

interface AdminContextValue extends AdminState {
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { email: string; password: string; name: string; specialty: string }) => Promise<void>;
  firebaseLogin: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminState>({
    token: null,
    email: null,
    role: null,
    loggedIn: false,
    loading: true,
  });

  useEffect(() => {
    (async () => {
      const [token, email, role] = await Promise.all([
        authStorage.getAdminToken(),
        authStorage.getAdminEmail(),
        authStorage.getAdminRole(),
      ]);
      setState({
        token,
        email,
        role,
        loggedIn: !!token,
        loading: false,
      });
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await adminService.login(email, password);
    setState({ token: data.token, email, role: data.role || 'expert', loggedIn: true, loading: false });
  }, []);

  const signup = useCallback(async (data: { email: string; password: string; name: string; specialty: string }) => {
    await adminService.signup(data);
  }, []);

  const firebaseLogin = useCallback(async (idToken: string) => {
    const data = await adminService.firebaseLogin(idToken);
    setState({ token: data.token, email: data.email, role: data.role || 'expert', loggedIn: true, loading: false });
  }, []);

  const logout = useCallback(async () => {
    await authStorage.clearAdmin();
    setState({ token: null, email: null, role: null, loggedIn: false, loading: false });
  }, []);

  return (
    <AdminContext.Provider value={{ ...state, login, signup, firebaseLogin, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
