import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useActiveTripStore } from '../store/activeTripStore';
import { useTripStore } from '../store/tripStore';

/**
 * Whenever the URL is /trip/:tripId/..., force activeTripStore + tripStore
 * to match that id. Fixes notification deep-links that left bottom-nav on
 * another trip while the page path pointed at a different one.
 */
export function useTripRouteSync() {
  const { pathname } = useLocation();
  const loadTrip = useTripStore((s) => s.loadTrip);
  const setActiveTrip = useActiveTripStore((s) => s.setActiveTrip);
  const lastSynced = useRef<string | null>(null);

  const match = pathname.match(/^\/trip\/([0-9a-fA-F-]{36})(?:\/|$)/);
  const routeTripId = match?.[1] ?? null;

  useEffect(() => {
    if (!routeTripId) return;
    if (lastSynced.current === routeTripId) {
      // Still re-check store in case something else changed active trip
      const active = useActiveTripStore.getState().activeTripId;
      const current = useTripStore.getState().currentTrip;
      if (active === routeTripId && current?.id === routeTripId) return;
    }

    let cancelled = false;
    (async () => {
      try {
        await loadTrip(routeTripId);
        if (cancelled) return;
        const trip = useTripStore.getState().currentTrip;
        if (trip?.id === routeTripId) {
          setActiveTrip(routeTripId, trip.name);
          lastSynced.current = routeTripId;
        } else {
          // load failed — still pin active id so bottom-nav paths use URL trip
          setActiveTrip(routeTripId, useActiveTripStore.getState().activeTripName || '');
          lastSynced.current = routeTripId;
        }
      } catch {
        if (!cancelled) {
          setActiveTrip(routeTripId, useActiveTripStore.getState().activeTripName || '');
          lastSynced.current = routeTripId;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeTripId, loadTrip, setActiveTrip]);
}
