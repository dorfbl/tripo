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

  const goToInfo      = () => go(activeTripId ? `/trip/${activeTripId}`           : '/');
  const goToExpenses  = () => go(activeTripId ? `/trip/${activeTripId}/expenses`  : '/');
  const goToMap       = () => go(activeTripId ? `/trip/${activeTripId}/map`       : '/');
  const goToDecisions = () => go(activeTripId ? `/trip/${activeTripId}/decisions` : '/');
  const goToLinks     = () => go(activeTripId ? `/trip/${activeTripId}/links`     : '/');

  const isInfo      = /^\/trip\/[^/]+$/.test(pathname);
  const isExpenses  = /^\/trip\/[^/]+\/expenses/.test(pathname);
  const isMap       = /^\/trip\/[^/]+\/map$/.test(pathname);
  const isDecisions = /^\/trip\/[^/]+\/decisions/.test(pathname);
  const isLinks     = /^\/trip\/[^/]+\/links/.test(pathname);

  const tabs = [
    {
      id: 'info', label: 'מידע', active: isInfo, onClick: goToInfo,
      icon: (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="flex-shrink-0" style={{ width: 'clamp(16px, 4.5vw, 20px)', height: 'clamp(16px, 4.5vw, 20px)' }} stroke="currentColor" strokeWidth={a ? 2.2 : 1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
      ),
    },
    {
      id: 'decisions', label: 'החלטות', active: isDecisions, onClick: goToDecisions,
      icon: (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="flex-shrink-0" style={{ width: 'clamp(16px, 4.5vw, 20px)', height: 'clamp(16px, 4.5vw, 20px)' }} stroke="currentColor" strokeWidth={a ? 2.2 : 1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      ),
    },
    {
      id: 'links', label: 'קישורים', active: isLinks, onClick: goToLinks,
      icon: (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="flex-shrink-0" style={{ width: 'clamp(16px, 4.5vw, 20px)', height: 'clamp(16px, 4.5vw, 20px)' }} stroke="currentColor" strokeWidth={a ? 2.2 : 1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
        </svg>
      ),
    },
    {
      id: 'expenses', label: 'הוצאות', active: isExpenses, onClick: goToExpenses,
      icon: (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="flex-shrink-0" style={{ width: 'clamp(16px, 4.5vw, 20px)', height: 'clamp(16px, 4.5vw, 20px)' }} stroke="currentColor" strokeWidth={a ? 2.2 : 1.7}>
          <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round"/>
          <path strokeLinecap="round" d="M2 10h20M6 15h3M15 15h3"/>
        </svg>
      ),
    },
    {
      id: 'map', label: 'מפה', active: isMap, onClick: goToMap,
      icon: (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="flex-shrink-0" style={{ width: 'clamp(16px, 4.5vw, 20px)', height: 'clamp(16px, 4.5vw, 20px)' }} stroke="currentColor" strokeWidth={a ? 2.2 : 1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6 3m0 10l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 10V7"/>
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
        {tabs.map(tab => (
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
            <span className="font-bold leading-none" style={{ fontSize: 'clamp(8px, 2.4vw, 11px)' }}>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};
