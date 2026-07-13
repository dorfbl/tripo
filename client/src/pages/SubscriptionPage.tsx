import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import apiClient from '../api/client';
import type { PlanTier, SubscriptionSnapshot } from '../types';
import { useAuthStore } from '../store/authStore';

export const SubscriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const { loadUser } = useAuthStore();
  const [snap, setSnap] = useState<(SubscriptionSnapshot & { isSuperAdmin?: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<SubscriptionSnapshot & { isSuperAdmin?: boolean }>(
        '/api/subscription/me',
      );
      setSnap(data);
    } catch {
      setError('שגיאה בטעינת המנוי');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setPlan = async (plan: PlanTier) => {
    setSaving(true);
    setError('');
    setMsg('');
    try {
      await apiClient.post('/api/subscription/me/plan', { plan, days: 30 });
      await load();
      await loadUser();
      setMsg(plan === 'FREE' ? 'חזרת לתוכנית חינם' : `עודכן ל־${plan}`);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'שגיאה בעדכון תוכנית');
    } finally {
      setSaving(false);
    }
  };

  const bar = (used: number, limit: number) => {
    const pct = limit <= 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
    const color =
      pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-brand-500';
    return (
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden mt-1.5">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    );
  };

  if (loading || !snap) {
    return (
      <AppShell showBottomNav>
        <div className="text-center py-12 text-neutral-400">טוען מנוי...</div>
      </AppShell>
    );
  }

  const { plan, usage, remaining, formatted, catalog } = snap;

  return (
    <AppShell showBottomNav>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/profile')} className="text-neutral-400 text-xl">
          ›
        </button>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">💎 מנוי ומכסות</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            תוכנית נוכחית: <span className="font-semibold text-brand-600">{plan.nameHe}</span>
            {plan.expiresAt && (
              <span className="text-neutral-400">
                {' '}
                · עד {new Date(plan.expiresAt).toLocaleDateString('he-IL')}
              </span>
            )}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
      {msg && <p className="text-sm text-green-600 mb-3">{msg}</p>}

      {snap.isSuperAdmin && (
        <button
          onClick={() => navigate('/admin/plans')}
          className="w-full mb-4 flex items-center justify-between px-4 py-3.5 rounded-2xl border border-amber-200 bg-amber-50 text-right active:bg-amber-100"
        >
          <div>
            <p className="text-sm font-bold text-amber-900">🛡️ ניהול מנויים (סופר־אדמין)</p>
            <p className="text-xs text-amber-700 mt-0.5">שנה תוכניות למשתמשים · ערוך מכסות</p>
          </div>
          <span className="text-amber-600 text-sm font-medium">פתח ←</span>
        </button>
      )}

      <Card className="p-4 mb-4">
        <h2 className="font-semibold text-neutral-800 mb-3">שימוש בחודש {usage.period}</h2>

        <div className="mb-3">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">טיולים (כמנהל)</span>
            <span className="font-medium">
              {usage.trips} / {plan.limits.maxTrips}
              {remaining.trips === 0 && <span className="text-red-500 mr-1"> · מלא</span>}
            </span>
          </div>
          {bar(usage.trips, plan.limits.maxTrips)}
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">קריאות AI</span>
            <span className="font-medium">
              {usage.aiCalls} / {plan.limits.maxAiCallsPerMonth}
              {remaining.aiCalls === 0 && <span className="text-red-500 mr-1"> · נגמר</span>}
            </span>
          </div>
          {bar(usage.aiCalls, plan.limits.maxAiCallsPerMonth)}
        </div>

        <div className="mb-1">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">אחסון</span>
            <span className="font-medium">
              {formatted.storageUsed} / {formatted.storageLimit}
            </span>
          </div>
          {bar(usage.storageBytes, plan.limits.maxStorageBytes)}
        </div>

        <p className="text-xs text-neutral-400 mt-3">
          חברים לטיול: עד <strong>{plan.limits.maxMembersPerTrip}</strong> (לפי תוכנית בעל הטיול)
        </p>
      </Card>

      <h2 className="font-semibold text-neutral-800 mb-2">תוכניות</h2>
      <div className="flex flex-col gap-2 mb-6">
        {catalog.map((p) => {
          const active = p.id === plan.id;
          return (
            <Card
              key={p.id}
              className={`p-4 ${active ? 'ring-2 ring-brand-500' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-neutral-900">
                    {p.nameHe}
                    {active && (
                      <span className="text-xs text-brand-600 font-medium mr-2">· נוכחית</span>
                    )}
                  </p>
                  <ul className="text-xs text-neutral-500 mt-1.5 space-y-0.5">
                    <li>{p.maxTrips} טיולים</li>
                    <li>{p.maxMembersPerTrip} חברים לטיול</li>
                    <li>{p.maxAiCallsPerMonth} קריאות AI / חודש</li>
                    <li>{p.maxStorageLabel} אחסון</li>
                  </ul>
                </div>
                {!active && (
                  <button
                    disabled={saving}
                    onClick={() => setPlan(p.id)}
                    className="text-xs font-bold px-3 py-2 rounded-xl bg-brand-500 text-white disabled:opacity-50 flex-shrink-0"
                  >
                    {p.id === 'FREE' ? 'עבור לחינם' : 'בחר'}
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-[11px] text-neutral-400 text-center leading-relaxed">
        תשלום אמיתי עדיין לא מחובר — בחירת תוכנית כאן היא לבדיקות.
        <br />
        Business זמין למנהלי מערכת בלבד.
      </p>
    </AppShell>
  );
};
