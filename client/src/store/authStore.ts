import { create } from 'zustand';
import type { User } from '../types';
import apiClient from '../api/client';
import {
  registerBiometric as registerBiometricUtil,
  authenticateWithBiometric,
  isBiometricAvailable,
  hasSavedBiometric,
} from '../lib/biometric';

const clearPersistedStores = () => {
  localStorage.removeItem('tripo-active-trip');
};

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithBiometric: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  registerBiometric: () => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateProfile: (data: { name?: string; aiEnabled?: boolean }) => Promise<void>;
  uploadAvatar:  (file: File) => Promise<void>;
  isBiometricAvailable: () => boolean;
  hasSavedBiometric: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
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

  loginWithBiometric: async () => {
    set({ isLoading: true });
    try {
      clearPersistedStores();

      // אימות ביומטרי
      const authData = await authenticateWithBiometric();

      // שליחה לשרת
      const res = await apiClient.post('/api/auth/biometric/login', {
        credentialId: authData.credentialId,
      });

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

  registerBiometric: async () => {
    const { user } = get();
    if (!user) {
      throw new Error('יש להתחבר תחילה');
    }

    try {
      // יצירת credential ביומטרי
      const credential = await registerBiometricUtil(user.id, user.email);

      // שליחה לשרת
      await apiClient.post('/api/auth/biometric/register', {
        credentialId: credential.id,
        publicKey: credential.publicKey,
      });
    } catch (err) {
      throw err;
    }
  },

  logout: () => {
    clearPersistedStores();
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  updateProfile: async (data) => {
    const res = await apiClient.put('/api/auth/profile', data);
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

  isBiometricAvailable: () => isBiometricAvailable(),
  hasSavedBiometric: () => hasSavedBiometric(),
}));
