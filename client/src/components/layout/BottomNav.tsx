import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useActiveTripStore } from '../../store/activeTripStore';
import {
  planSubFromPath,
  planSubPath,
  tabFromPath,
  tripTabPath,
  type TripTab,
} from '../../lib/tripNav';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    activeTripId,
    setLastTab,
    setLastPlanSub,
  } = useActiveTripStore();

  const activeTab = tabFromPath(pathname);

  // Persist last tab / plan sub from URL so re-entry restores it
  useEffect(() => {
    if (!activeTripId) return;
    const tab = tabFromPath(pathname);
    if (tab) setLastTab(tab);
    const planSub = planSubFromPath(pathname);
    if (planSub) setLastPlanSub(planSub);
  }, [pathname, activeTripId, setLastTab, setLastPlanSub]);

  const go = (path: string) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const goTab = (tab: TripTab) => {
    if (!activeTripId) {
      go('/');
      return;
    }
    setLastTab(tab);
    // תכנון always opens the plan hub (החלטות) — schedule/activities are sub-tabs there.
    // Do not jump straight to lastPlanSub (e.g. לוח זמנים).
    if (tab === 'plan') {
      setLastPlanSub('decisions');
      go(planSubPath(activeTripId, 'decisions'));
      return;
    }
    go(tripTabPath(activeTripId, tab));
  };

  const tabs: {
    id: TripTab;
    label: string;
    active: boolean;
    onClick: () => void;
    icon: (a: boolean) => React.ReactNode;
  }[] = [
    {
      id: 'home',
      label: 'בית',
      active: activeTab === 'home',
      onClick: () => goTab('home'),
      icon: (a) => (
        <svg viewBox="0 0 24 24" fill="none" className="flex-shrink-0" style={{ width: 'clamp(16px, 4.5vw, 20px)', height: 'clamp(16px, 4.5vw, 20px)' }} stroke="currentColor" strokeWidth={a ? 2.2 : 1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'plan',
      label: 'תכנון',
      active: activeTab === 'plan',
      onClick: () => goTab('plan'),
      icon: (a) => (
        <svg viewBox="0 0 24 24" fill="none" className="flex-shrink-0" style={{ width: 'clamp(16px, 4.5vw, 20px)', height: 'clamp(16px, 4.5vw, 20px)' }} stroke="currentColor" strokeWidth={a ? 2.2 : 1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'map',
      label: 'מפה',
      active: activeTab === 'map',
      onClick: () => goTab('map'),
      icon: (a) => (
        <svg viewBox="0 0 24 24" fill="none" className="flex-shrink-0" style={{ width: 'clamp(16px, 4.5vw, 20px)', height: 'clamp(16px, 4.5vw, 20px)' }} stroke="currentColor" strokeWidth={a ? 2.2 : 1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6 3m0 10l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 10V7" />
        </svg>
      ),
    },
    {
      id: 'money',
      label: 'כסף',
      active: activeTab === 'money',
      onClick: () => goTab('money'),
      icon: (a) => (
        <svg viewBox="0 0 24 24" fill="none" className="flex-shrink-0" style={{ width: 'clamp(16px, 4.5vw, 20px)', height: 'clamp(16px, 4.5vw, 20px)' }} stroke="currentColor" strokeWidth={a ? 2.2 : 1.7}>
          <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round" />
          <path strokeLinecap="round" d="M2 10h20M6 15h3M15 15h3" />
        </svg>
      ),
    },
    {
      id: 'trip',
      label: 'טיול',
      active: activeTab === 'trip',
      onClick: () => goTab('trip'),
      icon: (a) => (
        <svg viewBox="0 0 24 24" fill="none" className="flex-shrink-0" style={{ width: 'clamp(16px, 4.5vw, 20px)', height: 'clamp(16px, 4.5vw, 20px)' }} stroke="currentColor" strokeWidth={a ? 2.2 : 1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 right-0 left-0 z-[9999] bg-white border-t border-neutral-100"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
        paddingTop: '2px',
      }}
    >
      <div className="flex max-w-2xl mx-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={tab.onClick}
            className={`flex-1 min-w-0 relative flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
              tab.active ? 'text-brand-500' : 'text-neutral-400'
            }`}
          >
            {tab.active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-brand-500 rounded-b-full" />
            )}
            {tab.icon(tab.active)}
            <span className="font-bold leading-none" style={{ fontSize: 'clamp(8px, 2.4vw, 11px)' }}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};
