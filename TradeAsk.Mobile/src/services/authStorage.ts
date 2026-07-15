import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEYS = {
  SESSION_TOKEN: 'tradeask_session_token',
  EMAIL: 'tradeask_email',
  ADMIN_TOKEN: 'tradeask_admin_token',
  ADMIN_EMAIL: 'tradeask_admin_email',
  ADMIN_ROLE: 'tradeask_admin_role',
} as const;

async function get(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function set(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function remove(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const authStorage = {
  getSessionToken: () => get(KEYS.SESSION_TOKEN),
  setSessionToken: (v: string) => set(KEYS.SESSION_TOKEN, v),
  removeSessionToken: () => remove(KEYS.SESSION_TOKEN),

  getEmail: () => get(KEYS.EMAIL),
  setEmail: (v: string) => set(KEYS.EMAIL, v),
  removeEmail: () => remove(KEYS.EMAIL),

  getAdminToken: () => get(KEYS.ADMIN_TOKEN),
  setAdminToken: (v: string) => set(KEYS.ADMIN_TOKEN, v),
  removeAdminToken: () => remove(KEYS.ADMIN_TOKEN),

  getAdminEmail: () => get(KEYS.ADMIN_EMAIL),
  setAdminEmail: (v: string) => set(KEYS.ADMIN_EMAIL, v),

  getAdminRole: () => get(KEYS.ADMIN_ROLE),
  setAdminRole: (v: string) => set(KEYS.ADMIN_ROLE, v),

  async clearAll() {
    await Promise.all(Object.values(KEYS).map(k => remove(k)));
  },

  async clearChat() {
    await remove(KEYS.SESSION_TOKEN);
    await remove(KEYS.EMAIL);
  },

  async clearAdmin() {
    await remove(KEYS.ADMIN_TOKEN);
    await remove(KEYS.ADMIN_EMAIL);
    await remove(KEYS.ADMIN_ROLE);
  },
};
