import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';

export const EditProfilePage: React.FC = () => {
  const { user, updateProfile } = useAuthStore();
  const navigate = useNavigate();

  const [name,    setName]    = useState(user?.name ?? '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('שם הוא שדה חובה'); return; }
    setError('');
    setSaving(true);
    try {
      await updateProfile(name.trim());
      setSuccess(true);
      setTimeout(() => navigate('/profile'), 1000);
    } catch {
      setError('שגיאה בשמירת הפרופיל');
    } finally {
      setSaving(false);
    }
  };

  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <AppShell showBottomNav maxWidth="sm">

      {/* כותרת */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/profile')}
          className="text-neutral-400 hover:text-neutral-700 transition-colors text-xl leading-none"
        >
          ›
        </button>
        <h1 className="text-xl font-bold text-neutral-900">עריכת פרופיל</h1>
      </div>

      {/* תצוגה מקדימה של Avatar */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center text-2xl font-bold text-brand-600">
          {initials}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card className="p-5 flex flex-col gap-4">

          {/* שם */}
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">שם מלא</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setSuccess(false); }}
              placeholder="השם שלך"
              className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* אימייל — לא ניתן לעריכה */}
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">
              אימייל
              <span className="text-xs font-normal text-neutral-400 mr-1.5">לא ניתן לשינוי</span>
            </label>
            <input
              type="email"
              value={user?.email ?? ''}
              disabled
              className="w-full border border-neutral-100 rounded-xl px-3 py-2.5 text-sm bg-neutral-50 text-neutral-400 cursor-not-allowed"
            />
          </div>

          {/* סיסמה — לא ניתן לעריכה */}
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">
              סיסמה
              <span className="text-xs font-normal text-neutral-400 mr-1.5">לא ניתן לשינוי</span>
            </label>
            <input
              type="password"
              value="••••••••"
              disabled
              className="w-full border border-neutral-100 rounded-xl px-3 py-2.5 text-sm bg-neutral-50 text-neutral-400 cursor-not-allowed"
            />
          </div>

        </Card>

        {error   && <p className="text-sm text-red-500 text-center">{error}</p>}
        {success && <p className="text-sm text-green-600 text-center font-medium">✅ הפרופיל עודכן!</p>}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={saving}
          disabled={!name.trim() || name.trim() === user?.name}
        >
          שמור שינויים
        </Button>
      </form>
    </AppShell>
  );
};
