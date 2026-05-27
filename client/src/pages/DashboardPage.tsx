import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { Trip } from '../types';
import apiClient from '../api/client';
import axios from 'axios';

const statusLabels: Record<string, { label: string; color: 'blue' | 'green' | 'yellow' | 'gray' }> = {
  PLANNING: { label: 'תכנון', color: 'blue' },
  VOTING: { label: 'הצבעות', color: 'yellow' },
  BOOKED: { label: 'נקבע', color: 'green' },
  ONGOING: { label: 'בדרך!', color: 'green' },
  COMPLETED: { label: 'הושלם', color: 'gray' },
};

export const DashboardPage: React.FC = () => {
  const { trips, loadTrips, isLoading } = useTripStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user ? ['test@test.com', 'dorfbl@gmail.com'].includes(user.email) : false;
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    loadTrips();
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setJoining(true);
    try {
      const res = await apiClient.post(`/api/trips/join/${inviteCode.trim()}`);
      navigate(`/trip/${res.data.trip.id}`);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setJoinError(err.response?.data?.error || 'שגיאה בהצטרפות');
      } else {
        setJoinError('שגיאה בהצטרפות');
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-neutral-900">
          הטיולים שלי
        </h1>
        {isAdmin && (
          <Button onClick={() => navigate('/create-trip')} size="sm">
            + טיול חדש
          </Button>
        )}
      </div>

      {/* הצטרפות דרך קוד */}
      <Card className="p-4 mb-6">
        <p className="text-sm font-medium text-neutral-700 mb-2">הצטרף לטיול עם קוד הזמנה</p>
        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="הדבק קוד הזמנה..."
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <Button type="submit" size="sm" loading={joining} disabled={!inviteCode.trim()}>
            הצטרף
          </Button>
        </form>
        {joinError && <p className="text-xs text-red-500 mt-1">{joinError}</p>}
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-neutral-400">טוען...</div>
      ) : trips.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🗺️</div>
          <p className="text-neutral-600 font-medium">אין לך טיולים עדיין</p>
          {isAdmin ? (
            <>
              <p className="text-neutral-400 text-sm mt-1">צור טיול חדש או הצטרף לאחד</p>
              <Button className="mt-4" onClick={() => navigate('/create-trip')}>
                צור טיול ראשון
              </Button>
            </>
          ) : (
            <p className="text-neutral-400 text-sm mt-1">הצטרף לטיול עם קוד הזמנה</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {trips.map((trip: Trip) => {
            const status = statusLabels[trip.status] || statusLabels.PLANNING;
            const myMember = trip.members?.find((m) => m.userId === user?.id);
            const completedCount = trip.members?.filter((m) => m.completedQuestionnaire).length ?? 0;
            const totalMembers = trip.members?.length ?? 0;

            return (
              <Card
                key={trip.id}
                className="p-4"
                onClick={() => navigate(`/trip/${trip.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-neutral-900 truncate">{trip.name}</h3>
                      {myMember?.role === 'ADMIN' && (
                        <span className="text-xs text-neutral-400">👑</span>
                      )}
                    </div>
                    {trip.startDate && (
                      <p className="text-xs text-neutral-400 mb-2">
                        {new Date(trip.startDate).toLocaleDateString('he-IL')}
                        {trip.endDate && ` — ${new Date(trip.endDate).toLocaleDateString('he-IL')}`}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <span>👥 {totalMembers} חברים</span>
                      {trip.status === 'PLANNING' && (
                        <span>✅ {completedCount}/{totalMembers} מילאו שאלון</span>
                      )}
                    </div>
                  </div>
                  <Badge color={status.color}>{status.label}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
};
