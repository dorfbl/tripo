import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';
import { useActiveTripStore } from '../store/activeTripStore';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { Trip } from '../types';
import apiClient from '../api/client';
import axios from 'axios';

const STATUS: Record<string, { label: string; color: 'blue' | 'green' | 'yellow' | 'gray' }> = {
  PLAN:     { label: 'תכנון',  color: 'blue'  },
  LIVE:     { label: 'בדרך!',  color: 'green' },
  FINISHED: { label: 'הסתיים', color: 'gray'  },
  CANCELED: { label: 'בוטל',  color: 'gray'  },
};

export const DashboardPage: React.FC = () => {
  const { trips, loadTrips, isLoading } = useTripStore();
  const { user } = useAuthStore();
  const { activeTripId, setActiveTrip } = useActiveTripStore();
  const navigate  = useNavigate();
  const location  = useLocation();

  const showDashboard = (location.state as { showDashboard?: boolean })?.showDashboard;

  const [inviteCode, setInviteCode] = useState('');
  const [joinError,  setJoinError]  = useState('');
  const [joining,    setJoining]    = useState(false);

  useEffect(() => { loadTrips(); }, []);

  // redirect חכם
  useEffect(() => {
    if (isLoading || showDashboard) return;
    if (activeTripId && trips.some(t => t.id === activeTripId)) {
      // יש טיול פעיל — נווט אליו
      navigate(`/trip/${activeTripId}`, { replace: true });
    } else if (!isLoading && trips.length === 1) {
      // טיול יחיד — בחר אוטומטית
      setActiveTrip(trips[0].id, trips[0].name);
      navigate(`/trip/${trips[0].id}`, { replace: true });
    }
    // אם יש כמה טיולים ואין פעיל — נשאר בדף לבחירה
  }, [isLoading, trips, activeTripId, showDashboard]);

  const handleSelectTrip = (trip: Trip) => {
    setActiveTrip(trip.id, trip.name);
    navigate(`/trip/${trip.id}`);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setJoining(true);
    try {
      const res = await apiClient.post(`/api/trips/join/${inviteCode.trim()}`);
      const trip = res.data.trip as Trip;
      setActiveTrip(trip.id, trip.name);
      navigate(`/trip/${trip.id}`);
    } catch (err) {
      setJoinError(axios.isAxiosError(err) ? err.response?.data?.error || 'שגיאה' : 'שגיאה');
    } finally {
      setJoining(false);
    }
  };

  return (
    <AppShell showBottomNav>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-neutral-900">
          {trips.length > 1 ? '✈️ בחר טיול פעיל' : 'הטיולים שלי'}
        </h1>
        <Button onClick={() => navigate('/create-trip')} size="sm">+ טיול חדש</Button>
      </div>

      {trips.length > 1 && (
        <p className="text-sm text-neutral-500 mb-4">בחר את הטיול שישמש כטיול הפעיל שלך:</p>
      )}

      {/* הצטרפות דרך קוד */}
      <Card className="p-4 mb-5">
        <p className="text-sm font-medium text-neutral-700 mb-2">הצטרף לטיול עם קוד הזמנה</p>
        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            type="text"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            placeholder="הדבק קוד הזמנה..."
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <Button type="submit" size="sm" loading={joining} disabled={!inviteCode.trim()}>הצטרף</Button>
        </form>
        {joinError && <p className="text-xs text-red-500 mt-1">{joinError}</p>}
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-neutral-400">טוען...</div>
      ) : trips.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🗺️</div>
          <p className="text-neutral-600 font-medium">אין לך טיולים עדיין</p>
          <p className="text-neutral-400 text-sm mt-1">צור טיול חדש או הצטרף לאחד</p>
          <Button className="mt-4" onClick={() => navigate('/create-trip')}>צור טיול ראשון</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {trips.map((trip: Trip) => {
            const s = STATUS[trip.status] ?? STATUS.PLAN;
            const myMember = trip.members?.find(m => m.userId === user?.id);
            const isActive = trip.id === activeTripId;
            return (
              <Card
                key={trip.id}
                className={`p-4 cursor-pointer transition-all ${isActive ? 'ring-2 ring-brand-500' : ''}`}
                onClick={() => handleSelectTrip(trip)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-neutral-900 truncate">{trip.name}</h3>
                      {myMember?.role === 'ADMIN' && <span className="text-xs text-neutral-400">👑</span>}
                      {isActive && <span className="text-xs text-brand-500 font-medium">● פעיל</span>}
                    </div>
                    {trip.startDate && (
                      <p className="text-xs text-neutral-400">
                        {new Date(trip.startDate).toLocaleDateString('he-IL')}
                        {trip.endDate && ` — ${new Date(trip.endDate).toLocaleDateString('he-IL')}`}
                      </p>
                    )}
                    <p className="text-xs text-neutral-400 mt-1">
                      👥 {trip.members?.length ?? 0} חברים
                    </p>
                  </div>
                  <Badge color={s.color}>{s.label}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
};
