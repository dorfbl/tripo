import React from 'react';
import { Navbar } from './Navbar';

interface AppShellProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

export const AppShell: React.FC<AppShellProps> = ({ children, maxWidth = 'md' }) => {
  const widths = { sm: 'max-w-sm', md: 'max-w-2xl', lg: 'max-w-4xl' };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <main className={`${widths[maxWidth]} mx-auto px-4 py-6`}>
        {children}
      </main>
    </div>
  );
};
