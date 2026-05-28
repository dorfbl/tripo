import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import { useAuthStore } from '../store/authStore';
import { useActiveTripStore } from '../store/activeTripStore';

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { activeTripName, clearActiveTrip } = useActiveTripStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    clearActiveTrip();
    navigate('/login', { replace: true });
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <AppShell showBottomNav>
      <div className="flex flex-col gap-4">

        {/* כרטיס משתמש */}
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-xl font-bold text-brand-600 flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-neutral-900 leading-tight">{user?.name}</h2>
              <p className="text-sm text-neutral-400 mt-0.5">{user?.email}</p>
              {activeTripName && (
                <p className="text-xs text-brand-500 font-medium mt-1">✈️ {activeTripName}</p>
              )}
            </div>
          </div>
        </Card>

        {/* פעולות */}
        <Card className="overflow-hidden divide-y divide-neutral-100">

          {/* עריכת פרופיל */}
          <button
            onClick={() => navigate('/profile/edit')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition-colors"
          >
            <span className="text-sm font-medium text-neutral-800">✏️ עריכת פרופיל</span>
            <span className="text-neutral-300 text-lg">‹</span>
          </button>

          {/* כל הטיולים שלי */}
          <button
            onClick={() => navigate('/', { state: { showDashboard: true } })}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition-colors"
          >
            <span className="text-sm font-medium text-neutral-800">✈️ כל הטיולים שלי</span>
            <span className="text-neutral-300 text-lg">‹</span>
          </button>

          {/* יציאה */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-red-50 transition-colors"
          >
            <span className="text-sm font-medium text-red-500">יציאה</span>
            <span className="text-neutral-300 text-lg">‹</span>
          </button>
        </Card>

        <p className="text-xs text-neutral-300 text-center mt-2">TRIPO ✈️</p>
      </div>
    </AppShell>
  );
};
