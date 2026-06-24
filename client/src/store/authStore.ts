import { create } from 'zustand';
import type { User } from '../types';
import apiClient from '../api/client';

const clearPersistedStores = () => {
  localStorage.removeItem('tripo-active-trip');
};

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  uploadAvatar:  (file: File) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      clearPersistedStores();
      const res = await apiClient.post('/api/auth/login', { email, password });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      set({ token, user, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true });
    try {
      clearPersistedStores();
      const res = await apiClient.post('/api/auth/register', { name, email, password });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      set({ token, user, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    clearPersistedStores();
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  updateProfile: async (name) => {
    const res = await apiClient.put('/api/auth/profile', { name });
    set({ user: res.data.user });
  },

  uploadAvatar: async (file) => {
    const form = new FormData();
    form.append('avatar', file);
    // מחיקת Content-Type — מאפשר לדפדפן לשים multipart/form-data עם boundary אוטומטי
    const res = await apiClient.post('/api/auth/profile/avatar', form, {
      headers: { 'Content-Type': undefined },
    });
    set({ user: res.data.user });
  },

  loadUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await apiClient.get('/api/auth/me');
      set({ user: res.data.user });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null });
    }
  },
}));
