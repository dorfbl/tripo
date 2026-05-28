import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/tripStore';
import { AppShell } from '../components/layout/AppShell';
import { DestinationCard } from '../components/destinations/DestinationCard';
import { Button } from '../components/ui/Button';

export const DestinationsPage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const { destinations, loadDestinations, isLoading } = useTripStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (tripId) loadDestinations(tripId);
  }, [tripId]);

  const reload = () => { if (tripId) loadDestinations(tripId); };

  return (
    <AppShell showBottomNav maxWidth="lg">
      <button
        onClick={() => navigate(`/trip/${tripId}`)}
        className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1 mb-4"
      >
        ← חזרה לטיול
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">יעדים מומלצים</h1>
          <p className="text-sm text-neutral-500 mt-0.5">הצבע על היעד שמסקרן אותך ביותר</p>
        </div>
        <Button variant="ghost" size="sm" onClick={reload}>רענן</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-neutral-400">טוען יעדים...</div>
      ) : destinations.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🤖</div>
          <p className="text-neutral-600">לא נמצאו יעדים</p>
          <p className="text-neutral-400 text-sm mt-1">חזור לטיול וייצר המלצות</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {destinations.map((dest) => (
            <DestinationCard key={dest.id} destination={dest} onVoted={reload} />
          ))}
        </div>
      )}
    </AppShell>
  );
};
