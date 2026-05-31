import React from 'react';
import { Navbar } from './Navbar';
import { BottomNav } from './BottomNav';

interface AppShellProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | '2xl';
  showBottomNav?: boolean;
  noPadding?: boolean;
}

const widths = {
  sm: 'max-w-sm',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  '2xl': 'max-w-5xl',
};

export const AppShell: React.FC<AppShellProps> = ({
  children,
  maxWidth = 'md',
  showBottomNav,
  noPadding,
}) => {

  // ─── מפה — fullscreen, BottomNav fixed ───────────────────────────────────────
  if (noPadding && showBottomNav) {
    return (
      <div className="min-h-dvh bg-white relative">
        {children}
        <BottomNav />
      </div>
    );
  }

  // ─── דף עם BottomNav ─────────────────────────────────────────────────────────
  if (showBottomNav) {
    return (
      <div className="min-h-dvh bg-white flex flex-col">
        <main className={`${widths[maxWidth]} mx-auto px-4 pt-5 pb-24 w-full flex-1`}>
          {children}
        </main>
        <BottomNav />
      </div>
    );
  }

  // ─── דף ללא BottomNav — Navbar עליון ─────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-neutral-50 flex flex-col">
      <Navbar />
      <main className={`${widths[maxWidth]} mx-auto px-4 py-6 w-full`}>
        {children}
      </main>
    </div>
  );
};
