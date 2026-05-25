import { create } from 'zustand';
import api from '../api/client';

interface NotificationState {
  unreadCount: number;
  fetchUnreadCount: () => Promise<void>;
  setUnreadCount: (count: number) => void;
  incrementUnreadCount: () => void;
  decrementUnreadCount: () => void;
}

export const useNotifications = create<NotificationState>((set) => ({
  unreadCount: 0,
  fetchUnreadCount: async () => {
    try {
      const { data } = await api.get('/messages/unread-count');
      if (data && data.success && data.data) {
        set({ unreadCount: data.data.unread_count });
      }
    } catch (err) {
      console.error('[Notifications Store] Failed to fetch unread count:', err);
    }
  },
  setUnreadCount: (count) => set({ unreadCount: count }),
  incrementUnreadCount: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  decrementUnreadCount: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
}));
