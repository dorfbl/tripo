import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { useActiveTripStore } from '../../store/activeTripStore';

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const activeTripId = useActiveTripStore((s) => s.activeTripId);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    if (!token || !activeTripId) {
      setUnread(0);
      return;
    }
    try {
      const { data } = await apiClient.get('/api/notifications', {
        params: { limit: 1, tripId: activeTripId },
      });
      setUnread(data.unreadCount ?? 0);
    } catch {
      /* ignore */
    }
  }, [token, activeTripId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  return (
    <button
      type="button"
      onClick={() => navigate('/notifications')}
      className="relative p-2 rounded-full active:bg-neutral-100 text-neutral-600"
      aria-label="התראות"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
      </svg>
      {unread > 0 && (
        <span className="absolute top-0.5 left-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
};
