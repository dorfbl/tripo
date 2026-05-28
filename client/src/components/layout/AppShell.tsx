import React from 'react';
import { Navbar } from './Navbar';
import { BottomNav } from './BottomNav';

interface AppShellProps {
  children:       React.ReactNode;
  maxWidth?:      'sm' | 'md' | 'lg' | '2xl';
  showBottomNav?: boolean; // מציג תפריט תחתון + מסתיר navbar עליון
}

export const AppShell: React.FC<AppShellProps> = ({ children, maxWidth = 'md', showBottomNav }) => {
  const widths = { sm: 'max-w-sm', md: 'max-w-2xl', lg: 'max-w-4xl', '2xl': 'max-w-5xl' };

  return (
    <div className="min-h-screen bg-neutral-50">
      {!showBottomNav && <Navbar />}
      <main className={`${widths[maxWidth]} mx-auto px-4 ${showBottomNav ? 'pt-5 pb-28' : 'py-6'}`}>
        {children}
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  );
};
