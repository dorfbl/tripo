import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ActiveTripState {
  activeTripId:   string | null;
  activeTripName: string | null;
  setActiveTrip:  (id: string, name: string) => void;
  clearActiveTrip: () => void;
}

export const useActiveTripStore = create<ActiveTripState>()(
  persist(
    (set) => ({
      activeTripId:   null,
      activeTripName: null,
      setActiveTrip:  (id, name) => set({ activeTripId: id, activeTripName: name }),
      clearActiveTrip: () => set({ activeTripId: null, activeTripName: null }),
    }),
    { name: 'tripo-active-trip' }
  )
);
