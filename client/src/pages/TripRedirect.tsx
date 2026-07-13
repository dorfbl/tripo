import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useActiveTripStore } from '../store/activeTripStore';
import { tripTabPath } from '../lib/tripNav';

/** `/trip/:id` → last used tab (or home) */
export const TripRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const lastTab = useActiveTripStore((s) => s.lastTab);
  const lastPlanSub = useActiveTripStore((s) => s.lastPlanSub);

  if (!id) return <Navigate to="/" replace />;

  return <Navigate to={tripTabPath(id, lastTab, lastPlanSub)} replace />;
};
