import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import { NotificationBell } from './NotificationBell';

export const Navbar: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-neutral-100 sticky top-0 z-50">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-brand-500 text-lg tracking-tight">
          TRIPO ✈️
        </Link>
        {user && (
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button onClick={() => navigate('/profile')} className="flex items-center gap-2">
              <span className="text-sm text-neutral-500 hidden sm:block">{user.name}</span>
              <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export const TripTopBar: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 right-0 left-0 z-50 bg-white border-b border-neutral-100 h-14">
      <div className="max-w-2xl mx-auto px-4 h-full flex items-center justify-between">
        <Link to="/" className="font-bold text-brand-500 text-base tracking-tight">
          TRIPO ✈️
        </Link>
        {user && (
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button onClick={() => navigate('/profile')} className="active:opacity-70">
              <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
