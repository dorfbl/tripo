import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface BottomNavProps {
  tripId?: string;
}

const tabs = (tripId: string | undefined) => [
  {
    id: 'info',
    label: 'מידע',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5" strokeLinecap="round"/>
      </svg>
    ),
    path: tripId ? `/trip/${tripId}` : '/',
    match: (p: string) => !!tripId && p === `/trip/${tripId}`,
  },
  {
    id: 'expenses',
    label: 'הוצאות',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round"/>
        <path strokeLinecap="round" d="M2 10h20"/>
        <path strokeLinecap="round" d="M6 15h4M14 15h4"/>
      </svg>
    ),
    path: tripId ? `/trip/${tripId}/expenses` : '/',
    match: (p: string) => !!tripId && p === `/trip/${tripId}/expenses`,
  },
  {
    id: 'profile',
    label: 'פרופיל',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <circle cx="12" cy="8" r="4" strokeLinecap="round"/>
        <path strokeLinecap="round" d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/>
      </svg>
    ),
    path: '/profile',
    match: (p: string) => p === '/profile',
  },
];

export const BottomNav: React.FC<BottomNavProps> = ({ tripId }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navTabs = tabs(tripId);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-100 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex max-w-2xl mx-auto">
        {navTabs.map(tab => {
          const active = tab.match(pathname);
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path, { state: { tripId } })}
              className={`flex-1 flex flex-col items-center pt-3 pb-2 gap-1 transition-colors ${
                active ? 'text-brand-500' : 'text-neutral-400'
              }`}
            >
              {tab.icon(active)}
              <span className={`text-xs leading-none ${active ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
