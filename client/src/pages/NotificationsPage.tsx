import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import apiClient from '../api/client';
import { useActiveTripStore } from '../store/activeTripStore';
import { useTripStore } from '../store/tripStore';
import type { AppNotification } from '../types';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeTripId, activeTripName, setActiveTrip } = useActiveTripStore();
  const { loadTrip } = useTripStore();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!activeTripId) {
      setItems([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    try {
      const { data } = await apiClient.get('/api/notifications', {
        params: { limit: 50, tripId: activeTripId },
      });
      setItems(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [activeTripId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const openItem = async (n: AppNotification) => {
    if (!n.isRead) {
      try {
        await apiClient.post(`/api/notifications/${n.id}/read`);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        /* ignore */
      }
    }

    // Keep context on active trip (should already match)
    const targetTripId = n.tripId || n.trip?.id || activeTripId || extractTripIdFromHref(n.href);
    const targetName = n.trip?.name || activeTripName || '';
    if (targetTripId) {
      setActiveTrip(targetTripId, targetName);
      try {
        await loadTrip(targetTripId);
        const trip = useTripStore.getState().currentTrip;
        if (trip?.id === targetTripId) setActiveTrip(targetTripId, trip.name);
      } catch {
        /* navigate anyway */
      }
    }

    if (n.href) navigate(n.href);
    else if (targetTripId) navigate(`/trip/${targetTripId}/home`);
  };

  const markAll = async () => {
    if (!activeTripId) return;
    try {
      await apiClient.post('/api/notifications/read-all', null, {
        params: { tripId: activeTripId },
      });
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  const smartGenerate = async () => {
    if (!activeTripId) return;
    setGenerating(true);
    try {
      await apiClient.post(`/api/notifications/smart/${activeTripId}`);
      await load();
    } catch {
      /* ignore */
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppShell showBottomNav>
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">🔔 התראות</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {!activeTripId
              ? 'בחרו טיול פעיל'
              : unreadCount > 0
                ? `${unreadCount} שלא נקראו`
                : 'הכל מעודכן'}
            {activeTripName && (
              <span className="text-brand-500 font-medium"> · {activeTripName}</span>
            )}
          </p>
        </div>
        {activeTripId && (
          <div className="flex flex-col gap-1.5 items-end">
            {unreadCount > 0 && (
              <button onClick={markAll} className="text-xs font-bold text-brand-600">
                סמן הכל כנקרא
              </button>
            )}
            <button
              onClick={smartGenerate}
              disabled={generating}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 disabled:opacity-50"
            >
              {generating ? 'יוצר...' : '🤖 התראות חכמות'}
            </button>
          </div>
        )}
      </div>

      {!activeTripId ? (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-2">✈️</div>
          <p className="font-medium text-neutral-700">אין טיול פעיל</p>
          <p className="text-sm text-neutral-400 mt-1 mb-4">
            בחרו טיול כדי לראות את ההתראות שלו
          </p>
          <button
            type="button"
            onClick={() => navigate('/', { state: { showDashboard: true } })}
            className="text-sm font-bold text-brand-600"
          >
            לכל הטיולים ←
          </button>
        </Card>
      ) : loading ? (
        <div className="text-center py-12 text-neutral-400 text-sm">טוען...</div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-2">🔕</div>
          <p className="font-medium text-neutral-700">
            אין התראות{activeTripName ? ` לטיול "${activeTripName}"` : ''}
          </p>
          <p className="text-sm text-neutral-400 mt-1">
            לחצו על ״התראות חכמות״ ליצירת טיפים לטיול הפעיל
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => openItem(n)}
              className={`text-right w-full rounded-2xl border p-3.5 transition-colors ${
                n.isRead
                  ? 'bg-white border-neutral-100'
                  : 'bg-brand-50/50 border-brand-100'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-xl leading-none mt-0.5">{n.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-neutral-900">{n.title}</p>
                    {n.aiGenerated && (
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
                        AI
                      </span>
                    )}
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                    )}
                  </div>
                  {n.body && (
                    <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{n.body}</p>
                  )}
                  <p className="text-[11px] text-neutral-400 mt-1">
                    {new Date(n.createdAt).toLocaleString('he-IL', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
};

function extractTripIdFromHref(href?: string | null): string | null {
  if (!href) return null;
  const m = href.match(/\/trip\/([0-9a-fA-F-]{36})/);
  return m?.[1] ?? null;
}
