import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlanSubTab, TripTab } from '../lib/tripNav';
import { tripTabPath } from '../lib/tripNav';

interface ActiveTripState {
  activeTripId: string | null;
  activeTripName: string | null;
  /** Last bottom-nav tab used inside a trip */
  lastTab: TripTab;
  /** Last sub-tab under תכנון */
  lastPlanSub: PlanSubTab;
  setActiveTrip: (id: string, name: string) => void;
  clearActiveTrip: () => void;
  setLastTab: (tab: TripTab) => void;
  setLastPlanSub: (sub: PlanSubTab) => void;
  /** Path for the active trip's last used tab */
  lastTripPath: () => string | null;
}

export const useActiveTripStore = create<ActiveTripState>()(
  persist(
    (set, get) => ({
      activeTripId: null,
      activeTripName: null,
      lastTab: 'home',
      lastPlanSub: 'decisions',
      setActiveTrip: (id, name) => set({ activeTripId: id, activeTripName: name }),
      clearActiveTrip: () => set({ activeTripId: null, activeTripName: null }),
      setLastTab: (tab) => set({ lastTab: tab }),
      setLastPlanSub: (sub) => set({ lastPlanSub: sub }),
      lastTripPath: () => {
        const { activeTripId, lastTab, lastPlanSub } = get();
        if (!activeTripId) return null;
        return tripTabPath(activeTripId, lastTab, lastPlanSub);
      },
    }),
    {
      name: 'tripo-active-trip',
      partialize: (s) => ({
        activeTripId: s.activeTripId,
        activeTripName: s.activeTripName,
        lastTab: s.lastTab,
        lastPlanSub: s.lastPlanSub,
      }),
    },
  ),
);
