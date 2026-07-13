import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import { useAuthStore } from '../store/authStore';
import { useActiveTripStore } from '../store/activeTripStore';

export const ProfilePage: React.FC = () => {
  const { user, logout, updateProfile } = useAuthStore();
  const { activeTripName, clearActiveTrip } = useActiveTripStore();
  const navigate = useNavigate();
  const [savingAi, setSavingAi] = useState(false);

  const handleLogout = () => {
    logout();
    clearActiveTrip();
    navigate('/login', { replace: true });
  };

  const toggleAi = async () => {
    if (!user || savingAi) return;
    setSavingAi(true);
    try {
      await updateProfile({ aiEnabled: !(user.aiEnabled !== false) });
    } catch {
      /* ignore */
    } finally {
      setSavingAi(false);
    }
  };

  const aiOn = user?.aiEnabled !== false;

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <AppShell showBottomNav>
      <div className="flex flex-col gap-4">

        {/* כרטיס משתמש */}
        <Card className="p-5">
          <div className="flex items-center gap-4">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-14 h-14 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-xl font-bold text-brand-600 flex-shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-neutral-900 leading-tight">{user?.name}</h2>
              <p className="text-sm text-neutral-400 mt-0.5">{user?.email}</p>
              {activeTripName && (
                <p className="text-xs text-brand-500 font-medium mt-1">✈️ {activeTripName}</p>
              )}
            </div>
          </div>
        </Card>

        {/* הגדרות AI */}
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">🤖 עוזר AI</p>
              <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                סיכומי ציר זמן והתראות חכמות. אפשר לכבות בכל עת.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleAi}
              disabled={savingAi}
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                aiOn ? 'bg-brand-500' : 'bg-neutral-200'
              } disabled:opacity-50`}
              aria-pressed={aiOn}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  aiOn ? 'right-0.5' : 'right-5'
                }`}
              />
            </button>
          </div>
          <p className="text-[11px] text-neutral-400 mt-2">
            {aiOn ? 'AI פעיל עבורך' : 'AI כבוי עבורך'} · דורש גם הפעלה ברמת הטיול
          </p>
        </Card>

        {/* פעולות */}
        <Card className="overflow-hidden divide-y divide-neutral-100">

          <button
            onClick={() => navigate('/notifications')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition-colors"
          >
            <span className="text-sm font-medium text-neutral-800">🔔 התראות</span>
            <span className="text-neutral-300 text-lg">‹</span>
          </button>

          <button
            onClick={() => navigate('/subscription')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition-colors"
          >
            <span className="text-sm font-medium text-neutral-800">
              💎 מנוי ומכסות
              {user?.plan && user.plan !== 'FREE' && (
                <span className="text-xs text-brand-500 font-bold mr-2">{user.plan}</span>
              )}
            </span>
            <span className="text-neutral-300 text-lg">‹</span>
          </button>

          {user?.email?.toLowerCase() === 'dorfbl@gmail.com' && (
            <button
              onClick={() => navigate('/admin/plans')}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-amber-50 transition-colors"
            >
              <span className="text-sm font-medium text-amber-800">🛡️ ניהול מנויים (סופר־אדמין)</span>
              <span className="text-neutral-300 text-lg">‹</span>
            </button>
          )}

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
