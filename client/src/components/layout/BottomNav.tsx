import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useActiveTripStore } from '../../store/activeTripStore';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { activeTripId } = useActiveTripStore();

  const go = (path: string) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const goToInfo     = () => go(activeTripId ? `/trip/${activeTripId}`          : '/');
  const goToExpenses = () => go(activeTripId ? `/trip/${activeTripId}/expenses` : '/');
  const goToProfile  = () => go('/profile');

  const isInfo     = /^\/trip\/[^/]+$/.test(pathname);
  const isExpenses = /^\/trip\/[^/]+\/expenses$/.test(pathname);
  const isProfile  = pathname === '/profile';

  const tabs = [
    {
      id: 'info', label: 'מידע', active: isInfo, onClick: goToInfo,
      icon: (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={a ? 2.2 : 1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
      ),
    },
    {
      id: 'expenses', label: 'הוצאות', active: isExpenses, onClick: goToExpenses,
      icon: (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={a ? 2.2 : 1.7}>
          <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round"/>
          <path strokeLinecap="round" d="M2 10h20M6 15h3M15 15h3"/>
        </svg>
      ),
    },
    {
      id: 'profile', label: 'פרופיל', active: isProfile, onClick: goToProfile,
      icon: (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={a ? 2.2 : 1.7}>
          <circle cx="12" cy="8" r="4" strokeLinecap="round"/>
          <path strokeLinecap="round" d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/>
        </svg>
      ),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-100 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex max-w-2xl mx-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={tab.onClick}
            className={`flex-1 flex flex-col items-center pt-2 pb-1.5 gap-0.5 transition-colors ${
              tab.active ? 'text-brand-500' : 'text-neutral-400'
            }`}
          >
            {tab.icon(tab.active)}
            <span className={`text-[10px] leading-none ${tab.active ? 'font-semibold' : 'font-medium'}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};
