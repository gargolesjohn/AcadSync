import { create } from 'zustand';
import type { User, Preferences } from '../types';
import api from '../api/client';
import { useNotifications } from './notifications';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  prefs: Preferences;
  login: (userId: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  oauthLogin: (provider: string, token: string) => Promise<void>;
  logout: () => void;
  loadPrefs: () => Promise<void>;
  updatePrefs: (p: Partial<Preferences>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const defaultPrefs: Preferences = {
  dark_mode: true, accent_color: 'indigo',
  notifications_email: true, notifications_bell: true, notifications_messages: true,
};

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('acadsync_token'),
  loading: true,
  prefs: defaultPrefs,

  login: async (userId, password) => {
    const { data } = await api.post('/auth/login', { user_id: userId, password });
    const d = data.data;
    localStorage.setItem('acadsync_token', d.access_token);
    localStorage.setItem('acadsync_refresh', d.refresh_token);
    set({ user: d.user, token: d.access_token });
    get().loadPrefs();
    useNotifications.getState().fetchUnreadCount();
  },

  register: async (registerData) => {
    const { data } = await api.post('/auth/register', registerData);
    const d = data.data;
    localStorage.setItem('acadsync_token', d.access_token);
    localStorage.setItem('acadsync_refresh', d.refresh_token);
    set({ user: d.user, token: d.access_token });
    get().loadPrefs();
    useNotifications.getState().fetchUnreadCount();
  },

  oauthLogin: async (provider, token) => {
    const { data } = await api.post('/auth/oauth', { provider, token });
    const d = data.data;
    localStorage.setItem('acadsync_token', d.access_token);
    localStorage.setItem('acadsync_refresh', d.refresh_token);
    set({ user: d.user, token: d.access_token });
    get().loadPrefs();
    useNotifications.getState().fetchUnreadCount();
  },

  logout: () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('acadsync_token');
    localStorage.removeItem('acadsync_refresh');
    set({ user: null, token: null, prefs: defaultPrefs });
    useNotifications.getState().setUnreadCount(0);
  },

  loadPrefs: async () => {
    try {
      const { data } = await api.get('/preferences');
      const p = data.data;
      set({ prefs: p });
      document.documentElement.setAttribute('data-theme', p.dark_mode ? 'dark' : 'light');
      document.documentElement.setAttribute('data-accent', p.accent_color || 'indigo');
    } catch {}
  },

  updatePrefs: async (p) => {
    await api.patch('/preferences', p);
    const merged = { ...get().prefs, ...p };
    set({ prefs: merged });
    document.documentElement.setAttribute('data-theme', merged.dark_mode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-accent', merged.accent_color || 'indigo');
  },

  refreshUser: async () => {
    try {
      const { data } = await api.get('/users/me');
      set({ user: data.data, loading: false });
      get().loadPrefs();
      useNotifications.getState().fetchUnreadCount();
    } catch {
      set({ user: null, token: null, loading: false });
      localStorage.removeItem('acadsync_token');
      localStorage.removeItem('acadsync_refresh');
      useNotifications.getState().setUnreadCount(0);
    }
  },
}));
