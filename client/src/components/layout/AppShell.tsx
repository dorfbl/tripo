import React from 'react';
import { Navbar } from './Navbar';
import { BottomNav } from './BottomNav';

interface AppShellProps {
  children:       React.ReactNode;
  maxWidth?:      'sm' | 'md' | 'lg' | '2xl';
  showBottomNav?: boolean;
  noPadding?:     boolean;
}

const widths = { sm: 'max-w-sm', md: 'max-w-2xl', lg: 'max-w-4xl', '2xl': 'max-w-5xl' };

// גובה ה-BottomNav (px) — ללא safe-area
export const NAV_H = 64;

export const AppShell: React.FC<AppShellProps> = ({
  children, maxWidth = 'md', showBottomNav, noPadding,
}) => {

  // ─── מפה — fullscreen, BottomNav מצית (fixed) מחוץ לתוכן ───────────────────
  if (noPadding && showBottomNav) {
    return (
      <div style={{ height: '100%', position: 'relative' }}>
        {children}
        <BottomNav />
      </div>
    );
  }

  // ─── דף עם BottomNav — גלילת body, nav fixed ──────────────────────────────
  if (showBottomNav) {
    return (
      <div className="min-h-full flex flex-col">
        <div
          className="flex-1 w-full"
          style={{ paddingBottom: `calc(${NAV_H}px + env(safe-area-inset-bottom, 0px) + 14px)` }}
        >
          <main className={`${widths[maxWidth]} mx-auto px-4 pt-5`}>
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── דף ללא BottomNav — Navbar עליון, גלילת body ────────────────────────────
  return (
    <div className="min-h-full flex flex-col">
      <Navbar />
      <div className="flex-1 bg-neutral-50 w-full">
        <main className={`${widths[maxWidth]} mx-auto px-4 py-6`}>
          {children}
        </main>
      </div>
    </div>
  );
};
