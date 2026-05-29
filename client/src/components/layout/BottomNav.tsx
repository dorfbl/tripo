import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useActiveTripStore } from '../../store/activeTripStore';
import { useAuthStore } from '../../store/authStore';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { activeTripId } = useActiveTripStore();
  const { user } = useAuthStore();

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const go = (path: string) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const goToInfo     = () => go(activeTripId ? `/trip/${activeTripId}`          : '/');
  const goToExpenses = () => go(activeTripId ? `/trip/${activeTripId}/expenses` : '/');
  const goToMap      = () => go(activeTripId ? `/trip/${activeTripId}/map`      : '/');
  const goToProfile  = () => go('/profile');

  const isInfo     = /^\/trip\/[^/]+$/.test(pathname);
  const isExpenses = /^\/trip\/[^/]+\/expenses/.test(pathname);
  const isMap      = /^\/trip\/[^/]+\/map$/.test(pathname);
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
      id: 'map', label: 'מפה', active: isMap, onClick: goToMap,
      icon: (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={a ? 2.2 : 1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6 3m0 10l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 10V7"/>
        </svg>
      ),
    },
    {
      id: 'profile', label: 'פרופיל', active: isProfile, onClick: goToProfile,
      icon: (a: boolean) => user?.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.name}
          className={`w-6 h-6 rounded-full object-cover ${a ? 'ring-2 ring-brand-500' : 'ring-1 ring-neutral-200'}`}
        />
      ) : (
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
          a ? 'bg-brand-500 text-white' : 'bg-neutral-200 text-neutral-600'
        }`}>
          {initials}
        </div>
      ),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-100 z-[9999]"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)',
        marginBottom: 'calc(-1 * env(safe-area-inset-bottom, 0px))',
      }}
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
