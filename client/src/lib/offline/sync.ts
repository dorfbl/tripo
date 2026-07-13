import apiClient from '../../api/client';
import { queueList, queueRemove } from './db';
import { useOfflineStore } from '../../store/offlineStore';

export async function flushOfflineQueue(): Promise<{ ok: number; failed: number }> {
  const store = useOfflineStore.getState();
  if (!navigator.onLine || store.syncing) return { ok: 0, failed: 0 };

  store.setSyncing(true);
  store.setLastError(null);

  let ok = 0;
  let failed = 0;

  try {
    const items = await queueList();
    for (const item of items) {
      if (item.id == null) continue;
      try {
        await apiClient.request({
          method: item.method as any,
          url: item.url,
          data: item.body,
          headers: {
            'X-Offline-Sync': '1',
            ...(item.headers || {}),
          },
        });
        await queueRemove(item.id);
        ok++;
      } catch (err: any) {
        failed++;
        // Drop 4xx (except 408/429) — permanent client errors
        const status = err?.response?.status;
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          await queueRemove(item.id);
        }
        store.setLastError(err?.response?.data?.error || 'סנכרון נכשל לפריט אחד');
        // Stop on first network error to preserve order
        if (!err?.response) break;
      }
    }
    store.setLastSyncAt(Date.now());
  } finally {
    await store.refreshPending();
    store.setSyncing(false);
  }

  return { ok, failed };
}

export function initOfflineListeners() {
  const store = useOfflineStore.getState();
  store.refreshPending();

  const onOnline = () => {
    store.setOnline(true);
    flushOfflineQueue();
  };
  const onOffline = () => store.setOnline(false);

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  if (navigator.onLine) {
    // light delayed flush
    setTimeout(() => flushOfflineQueue(), 1500);
  }

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
