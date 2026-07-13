import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import apiClient from '../api/client';
import type { PlanTier } from '../types';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: PlanTier;
  planExpiresAt: string | null;
  aiEnabled: boolean;
  storageBytesUsed: number;
  storageLabel: string;
  aiCallsThisMonth: number;
  tripsAsAdmin: number;
  period: string;
}

interface PlanConfig {
  id: PlanTier;
  nameHe: string;
  maxTrips: number;
  maxMembersPerTrip: number;
  maxAiCallsPerMonth: number;
  maxStorageBytes: number;
  maxStorageLabel: string;
  aiIncluded: boolean;
}

const PLAN_OPTIONS: PlanTier[] = ['FREE', 'PRO', 'BUSINESS'];

export const AdminPlansPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'users' | 'plans'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  // user edit draft
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editPlan, setEditPlan] = useState<PlanTier>('FREE');
  const [editDays, setEditDays] = useState('30');
  const [editNever, setEditNever] = useState(false);
  const [editAi, setEditAi] = useState(true);

  // plan config draft
  const [editPlanCfg, setEditPlanCfg] = useState<PlanConfig | null>(null);

  const loadUsers = useCallback(async (search = '') => {
    const { data } = await apiClient.get('/api/subscription/admin/users', {
      params: search ? { q: search } : {},
    });
    setUsers(data.users ?? []);
  }, []);

  const loadPlans = useCallback(async () => {
    const { data } = await apiClient.get('/api/subscription/admin/plans');
    setPlans(data.plans ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        // gate: only super admin can open
        const me = await apiClient.get('/api/subscription/me');
        if (!me.data.isSuperAdmin) {
          setError('אין הרשאת סופר־אדמין');
          setLoading(false);
          return;
        }
        await Promise.all([loadUsers(), loadPlans()]);
      } catch (e: any) {
        setError(e?.response?.data?.error || 'אין גישה');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadUsers, loadPlans]);

  const openUser = (u: AdminUser) => {
    setEditUser(u);
    setEditPlan(u.plan);
    setEditDays('30');
    setEditNever(!u.planExpiresAt && u.plan !== 'FREE');
    setEditAi(u.aiEnabled);
    setMsg('');
    setError('');
  };

  const saveUser = async () => {
    if (!editUser) return;
    setSavingId(editUser.id);
    setError('');
    setMsg('');
    try {
      await apiClient.patch(`/api/subscription/admin/users/${editUser.id}`, {
        plan: editPlan,
        days: editNever ? null : parseInt(editDays, 10) || 30,
        aiEnabled: editAi,
      });
      setMsg(`עודכן: ${editUser.email} → ${editPlan}`);
      setEditUser(null);
      await loadUsers(q);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'שגיאה בשמירה');
    } finally {
      setSavingId(null);
    }
  };

  const savePlanCfg = async () => {
    if (!editPlanCfg) return;
    setSavingId(editPlanCfg.id);
    setError('');
    setMsg('');
    try {
      await apiClient.put(`/api/subscription/admin/plans/${editPlanCfg.id}`, {
        nameHe: editPlanCfg.nameHe,
        maxTrips: editPlanCfg.maxTrips,
        maxMembersPerTrip: editPlanCfg.maxMembersPerTrip,
        maxAiCallsPerMonth: editPlanCfg.maxAiCallsPerMonth,
        maxStorageBytes: editPlanCfg.maxStorageBytes,
        aiIncluded: editPlanCfg.aiIncluded,
      });
      setMsg(`תוכנית ${editPlanCfg.id} נשמרה`);
      setEditPlanCfg(null);
      await loadPlans();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'שגיאה בשמירת תוכנית');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <AppShell showBottomNav>
        <div className="text-center py-12 text-neutral-400">טוען ניהול מנויים...</div>
      </AppShell>
    );
  }

  if (error && users.length === 0 && !editUser) {
    return (
      <AppShell showBottomNav>
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => navigate('/profile')} className="text-brand-600 font-medium">
            חזרה לפרופיל
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell showBottomNav>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/subscription')} className="text-neutral-400 text-xl">
          ›
        </button>
        <div>
          <h1 className="text-xl font-bold text-neutral-900">🛡️ ניהול מנויים</h1>
          <p className="text-xs text-neutral-500">סופר־אדמין · dorfbl@gmail.com</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 mb-4 bg-neutral-100 rounded-xl">
        {(
          [
            { id: 'users' as const, label: 'משתמשים' },
            { id: 'plans' as const, label: 'הגדרת תוכניות' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold ${
              tab === t.id ? 'bg-white text-brand-600 shadow-sm' : 'text-neutral-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      {msg && <p className="text-sm text-green-600 mb-2">{msg}</p>}

      {tab === 'users' && (
        <>
          <div className="flex gap-2 mb-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש שם / אימייל..."
              className="flex-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
            />
            <button
              onClick={() => loadUsers(q)}
              className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-bold"
            >
              חפש
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {users.map((u) => (
              <Card key={u.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900 truncate">{u.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{u.email}</p>
                    <p className="text-xs text-neutral-600 mt-1">
                      <span className="font-bold text-brand-600">{u.plan}</span>
                      {u.planExpiresAt
                        ? ` · עד ${new Date(u.planExpiresAt).toLocaleDateString('he-IL')}`
                        : u.plan !== 'FREE'
                          ? ' · ללא תפוגה'
                          : ''}
                      {' · '}
                      {u.tripsAsAdmin} טיולים · AI {u.aiCallsThisMonth} · {u.storageLabel}
                      {!u.aiEnabled && ' · AI כבוי'}
                    </p>
                  </div>
                  <button
                    onClick={() => openUser(u)}
                    className="text-xs font-bold text-brand-600 px-2 py-1.5 rounded-lg bg-brand-50 flex-shrink-0"
                  >
                    ערוך
                  </button>
                </div>
              </Card>
            ))}
            {users.length === 0 && (
              <p className="text-center text-neutral-400 text-sm py-8">לא נמצאו משתמשים</p>
            )}
          </div>
        </>
      )}

      {tab === 'plans' && (
        <div className="flex flex-col gap-2">
          {plans.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-neutral-900">
                    {p.nameHe}{' '}
                    <span className="text-xs text-neutral-400 font-mono">({p.id})</span>
                  </p>
                  <ul className="text-xs text-neutral-500 mt-1 space-y-0.5">
                    <li>{p.maxTrips} טיולים</li>
                    <li>{p.maxMembersPerTrip} חברים לטיול</li>
                    <li>{p.maxAiCallsPerMonth} AI / חודש</li>
                    <li>{p.maxStorageLabel} אחסון</li>
                    <li>{p.aiIncluded ? 'כולל AI' : 'בלי AI'}</li>
                  </ul>
                </div>
                <button
                  onClick={() => setEditPlanCfg({ ...p })}
                  className="text-xs font-bold text-brand-600 px-2 py-1.5 rounded-lg bg-brand-50"
                >
                  ערוך מכסות
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit user sheet */}
      {editUser && (
        <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditUser(null)} />
          <div className="relative bg-white rounded-t-3xl p-5 pb-10 shadow-2xl max-h-[85dvh] overflow-y-auto">
            <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-1">עריכת מנוי</h2>
            <p className="text-sm text-neutral-500 mb-4">
              {editUser.name} · {editUser.email}
            </p>

            <label className="text-xs font-bold text-neutral-600 mb-1.5 block">תוכנית</label>
            <div className="flex gap-2 mb-4">
              {PLAN_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setEditPlan(p)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border ${
                    editPlan === p
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-neutral-200 text-neutral-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {editPlan !== 'FREE' && (
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm text-neutral-700 mb-2">
                  <input
                    type="checkbox"
                    checked={editNever}
                    onChange={(e) => setEditNever(e.target.checked)}
                  />
                  ללא תאריך תפוגה
                </label>
                {!editNever && (
                  <div>
                    <label className="text-xs font-bold text-neutral-600 mb-1 block">
                      ימים עד תפוגה
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editDays}
                      onChange={(e) => setEditDays(e.target.value)}
                      className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            <label className="flex items-center justify-between text-sm text-neutral-700 mb-5">
              <span>העדפת AI של המשתמש</span>
              <input
                type="checkbox"
                checked={editAi}
                onChange={(e) => setEditAi(e.target.checked)}
              />
            </label>

            <button
              onClick={saveUser}
              disabled={savingId === editUser.id}
              className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-2xl disabled:opacity-50"
            >
              {savingId === editUser.id ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </div>
      )}

      {/* Edit plan config sheet */}
      {editPlanCfg && (
        <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditPlanCfg(null)} />
          <div className="relative bg-white rounded-t-3xl p-5 pb-10 shadow-2xl max-h-[85dvh] overflow-y-auto">
            <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-4">מכסות · {editPlanCfg.id}</h2>

            {(
              [
                { key: 'nameHe', label: 'שם בעברית', type: 'text' },
                { key: 'maxTrips', label: 'מקס׳ טיולים', type: 'number' },
                { key: 'maxMembersPerTrip', label: 'מקס׳ חברים לטיול', type: 'number' },
                { key: 'maxAiCallsPerMonth', label: 'קריאות AI לחודש', type: 'number' },
              ] as const
            ).map((f) => (
              <div key={f.key} className="mb-3">
                <label className="text-xs font-bold text-neutral-600 mb-1 block">{f.label}</label>
                <input
                  type={f.type}
                  value={(editPlanCfg as any)[f.key]}
                  onChange={(e) =>
                    setEditPlanCfg({
                      ...editPlanCfg,
                      [f.key]:
                        f.type === 'number' ? Number(e.target.value) : e.target.value,
                    })
                  }
                  className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm"
                />
              </div>
            ))}

            <div className="mb-3">
              <label className="text-xs font-bold text-neutral-600 mb-1 block">
                אחסון (MB)
              </label>
              <input
                type="number"
                value={Math.round(editPlanCfg.maxStorageBytes / (1024 * 1024))}
                onChange={(e) =>
                  setEditPlanCfg({
                    ...editPlanCfg,
                    maxStorageBytes: Math.round(Number(e.target.value) * 1024 * 1024),
                  })
                }
                className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm"
              />
              <p className="text-[11px] text-neutral-400 mt-1">{editPlanCfg.maxStorageLabel}</p>
            </div>

            <label className="flex items-center gap-2 text-sm mb-5">
              <input
                type="checkbox"
                checked={editPlanCfg.aiIncluded}
                onChange={(e) =>
                  setEditPlanCfg({ ...editPlanCfg, aiIncluded: e.target.checked })
                }
              />
              כולל AI
            </label>

            <button
              onClick={savePlanCfg}
              disabled={savingId === editPlanCfg.id}
              className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-2xl disabled:opacity-50"
            >
              {savingId === editPlanCfg.id ? 'שומר...' : 'שמור מכסות'}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
};
