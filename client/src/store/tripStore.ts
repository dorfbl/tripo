import { create } from 'zustand';
import type { Trip, Question, SuggestedDestination } from '../types';
import apiClient from '../api/client';

interface TripState {
  trips: Trip[];
  currentTrip: Trip | null;
  questions: Question[];
  destinations: SuggestedDestination[];
  isLoading: boolean;

  loadTrips: () => Promise<void>;
  loadTrip: (id: string) => Promise<void>;
  createTrip: (name: string, startDate?: string, endDate?: string) => Promise<Trip>;
  joinTrip: (inviteCode: string) => Promise<Trip>;
  loadQuestions: () => Promise<void>;
  saveAnswers: (tripId: string, answers: { questionId: string; answer: unknown }[]) => Promise<void>;
  loadDestinations: (tripId: string) => Promise<void>;
  generateDestinations: (tripId: string) => Promise<void>;
  voteDestination: (destinationId: string, score: number) => Promise<void>;
}

export const useTripStore = create<TripState>((set) => ({
  trips: [],
  currentTrip: null,
  questions: [],
  destinations: [],
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

  loadQuestions: async () => {
    const res = await apiClient.get('/api/questionnaire/questions');
    set({ questions: res.data.questions });
  },

  saveAnswers: async (tripId, answers) => {
    await apiClient.post(`/api/questionnaire/${tripId}/answers`, { answers });
  },

  loadDestinations: async (tripId) => {
    const res = await apiClient.get(`/api/destinations/${tripId}`);
    set({ destinations: res.data.destinations });
  },

  generateDestinations: async (tripId) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post(`/api/destinations/${tripId}/generate`);
      set({ destinations: res.data.destinations, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  voteDestination: async (destinationId, score) => {
    await apiClient.post(`/api/destinations/${destinationId}/vote`, { score });
  },
}));
