import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';

export const EditProfilePage: React.FC = () => {
  const { user, updateProfile, uploadAvatar, registerBiometric, isBiometricAvailable, hasSavedBiometric } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name,       setName]       = useState(user?.name ?? '');
  const [preview,    setPreview]    = useState<string | null>(null); // local blob preview
  const [uploading,  setUploading]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);
  const [biometricRegistering, setBiometricRegistering] = useState(false);
  const [biometricSuccess, setBiometricSuccess] = useState(false);

  // ─── בחירת תמונה ───────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // preview מקומי מיידי
    setPreview(URL.createObjectURL(file));
    setError('');
    setUploading(true);
    try {
      await uploadAvatar(file);
    } catch {
      setError('שגיאה בהעלאת התמונה');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  // ─── שמירת שם ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('שם הוא שדה חובה'); return; }
    setError('');
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      setSuccess(true);
      setTimeout(() => navigate('/profile'), 900);
    } catch {
      setError('שגיאה בשמירת הפרופיל');
    } finally {
      setSaving(false);
    }
  };

  // ─── רישום ביומטרי ─────────────────────────────────────────────────────────
  const handleRegisterBiometric = async () => {
    setError('');
    setBiometricRegistering(true);
    try {
      await registerBiometric();
      setBiometricSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'שגיאה ברישום ביומטרי');
    } finally {
      setBiometricRegistering(false);
    }
  };

  // ─── Avatar display ─────────────────────────────────────────────────────────
  const avatarSrc = preview ?? user?.avatarUrl ?? null;
  const initials  = name
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

      {/* Avatar עם כפתור עריכה */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          {/* תמונה / אותיות */}
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={name}
              className="w-24 h-24 rounded-full object-cover shadow-sm"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-brand-100 flex items-center justify-center text-3xl font-bold text-brand-600">
              {initials}
            </div>
          )}

          {/* כפתור עריכה */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 left-0 w-8 h-8 rounded-full bg-white border-2 border-neutral-200 shadow flex items-center justify-center hover:bg-neutral-50 transition-colors"
          >
            {uploading
              ? <span className="text-xs text-neutral-400 animate-spin">⟳</span>
              : <span className="text-sm">📷</span>
            }
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {uploading && (
        <p className="text-xs text-neutral-400 text-center mb-4">מעלה תמונה...</p>
      )}

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
          disabled={!name.trim() || (name.trim() === user?.name && !preview)}
        >
          שמור שינויים
        </Button>
      </form>

      {/* הגדרת התחברות ביומטרית */}
      {isBiometricAvailable() && (
        <Card className="p-5 mt-4">
          <h3 className="text-base font-semibold text-neutral-900 mb-2">התחברות ביומטרית</h3>
          <p className="text-sm text-neutral-600 mb-4">
            {hasSavedBiometric()
              ? 'התחברות ביומטרית מופעלת במכשיר זה'
              : 'הפעל התחברות מהירה באמצעות Face ID, Touch ID או טביעת אצבע'}
          </p>

          {biometricSuccess && (
            <p className="text-sm text-green-600 mb-3 font-medium">✅ התחברות ביומטרית הופעלה בהצלחה!</p>
          )}

          {!hasSavedBiometric() && (
            <Button
              onClick={handleRegisterBiometric}
              size="md"
              variant="secondary"
              loading={biometricRegistering}
              className="w-full"
            >
              <span className="flex items-center justify-center gap-2">
                <span>🔐</span>
                הפעל התחברות ביומטרית
              </span>
            </Button>
          )}

          {hasSavedBiometric() && (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <span className="text-green-500">✓</span>
              <span>התחברות ביומטרית זמינה</span>
            </div>
          )}
        </Card>
      )}
    </AppShell>
  );
};
