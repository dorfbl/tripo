import apiClient from '../../api/client';
import { cacheSet } from './db';

/** Prefetch + cache core trip modules for offline use */
export async function prefetchTripOffline(tripId: string): Promise<void> {
  const endpoints = [
    `/api/trips/${tripId}`,
    `/api/expenses/${tripId}`,
    `/api/places/${tripId}`,
    `/api/decisions/${tripId}`,
    `/api/links/${tripId}`,
    `/api/planner/${tripId}`,
    `/api/timeline/${tripId}?limit=40`,
    `/api/weather/${tripId}`,
    `/api/flights/${tripId}`,
    `/api/assistant/${tripId}`,
  ];

  await Promise.allSettled(
    endpoints.map(async (url) => {
      try {
        const res = await apiClient.get(url);
        await cacheSet(url, res.data);
      } catch {
        /* ignore individual failures */
      }
    }),
  );
}
