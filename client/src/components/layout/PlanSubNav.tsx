import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useActiveTripStore } from '../../store/activeTripStore';
import { planSubFromPath, planSubPath, type PlanSubTab } from '../../lib/tripNav';

const SUBS: { id: PlanSubTab; label: string; emoji: string }[] = [
  { id: 'decisions', label: 'החלטות', emoji: '✅' },
  { id: 'activities', label: 'פעילויות', emoji: '🗳️' },
  { id: 'schedule', label: 'לוח זמנים', emoji: '📅' },
];

export const PlanSubNav: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { setLastPlanSub, setLastTab } = useActiveTripStore();

  const active = planSubFromPath(pathname) ?? 'decisions';

  if (!tripId) return null;

  return (
    <div className="flex gap-1 p-1 mb-4 bg-neutral-100 rounded-xl max-w-xl">
      {SUBS.map((s) => {
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setLastTab('plan');
              setLastPlanSub(s.id);
              navigate(planSubPath(tripId, s.id));
            }}
            className={`flex-1 min-w-0 py-2 px-1 rounded-lg text-xs font-bold transition-colors ${
              isActive
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-neutral-500 active:bg-neutral-200/60 hover:text-neutral-700'
            }`}
          >
            <span className="block truncate">
              {s.emoji} {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
