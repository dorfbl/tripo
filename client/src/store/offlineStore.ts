import { create } from 'zustand';
import { queueList, type QueuedMutation } from '../lib/offline/db';

interface OfflineState {
  online: boolean;
  pending: QueuedMutation[];
  lastSyncAt: number | null;
  syncing: boolean;
  lastError: string | null;
  setOnline: (v: boolean) => void;
  refreshPending: () => Promise<void>;
  setSyncing: (v: boolean) => void;
  setLastSyncAt: (t: number | null) => void;
  setLastError: (e: string | null) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pending: [],
  lastSyncAt: null,
  syncing: false,
  lastError: null,
  setOnline: (v) => set({ online: v }),
  refreshPending: async () => {
    try {
      const pending = await queueList();
      set({ pending });
    } catch {
      set({ pending: [] });
    }
  },
  setSyncing: (v) => set({ syncing: v }),
  setLastSyncAt: (t) => set({ lastSyncAt: t }),
  setLastError: (e) => set({ lastError: e }),
}));
