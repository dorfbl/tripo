import { create } from 'zustand';
import type { Trip } from '../types';
import apiClient from '../api/client';

interface TripState {
  trips: Trip[];
  currentTrip: Trip | null;
  isLoading: boolean;

  loadTrips: () => Promise<void>;
  loadTrip: (id: string) => Promise<void>;
  createTrip: (name: string, startDate?: string, endDate?: string) => Promise<Trip>;
  joinTrip: (inviteCode: string) => Promise<Trip>;
}

export const useTripStore = create<TripState>((set) => ({
  trips: [],
  currentTrip: null,
  isLoading: false,

  loadTrips: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get('/api/trips');
      set({ trips: res.data.trips, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  loadTrip: async (id) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get(`/api/trips/${id}`);
      set({ currentTrip: res.data.trip, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createTrip: async (name, startDate, endDate) => {
    const res = await apiClient.post('/api/trips', { name, startDate, endDate });
    const trip = res.data.trip;
    set((state) => ({ trips: [trip, ...state.trips] }));
    return trip;
  },

  joinTrip: async (inviteCode) => {
    const res = await apiClient.post(`/api/trips/join/${inviteCode}`);
    const trip = res.data.trip;
    set((state) => ({ trips: [trip, ...state.trips] }));
    return trip;
  },
}));
