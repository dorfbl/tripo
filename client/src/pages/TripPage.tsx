import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';
import { useActiveTripStore } from '../store/activeTripStore';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import apiClient from '../api/client';
import type { TripStatus } from '../types';

const CURRENCIES = [
  { code: 'ILS', label: '₪ שקל' },
  { code: 'USD', label: '$ דולר' },
  { code: 'EUR', label: '€ יורו' },
  { code: 'GBP', label: '£ פאונד' },
  { code: 'CHF', label: '₣ פרנק שוויצרי' },
  { code: 'JPY', label: '¥ ין יפני' },
  { code: 'THB', label: '฿ בהט תאילנדי' },
  { code: 'CZK', label: "Kč קורונה צ'כית" },
  { code: 'HUF', label: 'Ft פורינט הונגרי' },
  { code: 'PLN', label: 'zł זלוטי פולני' },
  { code: 'AUD', label: 'A$ דולר אוסטרלי' },
  { code: 'CAD', label: 'C$ דולר קנדי' },
];

const STATUS_OPTIONS: { value: TripStatus; label: string; color: string }[] = [
  { value: 'PLAN',     label: 'תכנון',   color: 'bg-blue-100 text-blue-600' },
  { value: 'LIVE',     label: 'בדרך!',   color: 'bg-green-100 text-green-700' },
  { value: 'FINISHED', label: 'הסתיים',  color: 'bg-neutral-100 text-neutral-500' },
  { value: 'CANCELED', label: 'בוטל',    color: 'bg-red-100 text-red-500' },
];

const statusInfo = (s: TripStatus) => STATUS_OPTIONS.find(o => o.value === s) ?? STATUS_OPTIONS[0];

function toInputDate(iso: string | null | undefined) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

/** טיול hub — members, links, timeline, settings */
export const TripPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTrip, loadTrip, isLoading } = useTripStore();
  const { user } = useAuthStore();
  const { setActiveTrip } = useActiveTripStore();

  const [copied, setCopied] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editStatus, setEditStatus] = useState<TripStatus>('PLAN');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) loadTrip(id);
  }, [id]);

  useEffect(() => {
    if (id && currentTrip) setActiveTrip(id, currentTrip.name);
  }, [id, currentTrip?.name]);

  const openEdit = () => {
    if (!currentTrip) return;
    setEditName(currentTrip.name);
    setEditStart(toInputDate(currentTrip.startDate));
    setEditEnd(toInputDate(currentTrip.endDate));
    setEditStatus(currentTrip.status);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!id || !editName.trim()) return;
    setSaving(true);
    try {
      await apiClient.put(`/api/trips/${id}`, {
        name: editName.trim(),
        startDate: editStart || null,
        endDate:   editEnd   || null,
        status:    editStatus,
      });
      await loadTrip(id);
      setEditOpen(false);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleChangeRole = async (userId: string, currentRole: 'ADMIN' | 'MEMBER') => {
    if (!id) return;
    const newRole = currentRole === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    setChangingRoleUserId(userId);
    try {
      await apiClient.patch(`/api/trips/${id}/members/${userId}/role`, { role: newRole });
      await loadTrip(id);
    } catch { /* silent */ }
    finally { setChangingRoleUserId(null); }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!id || !confirm(`להסיר את ${name} מהטיול?`)) return;
    setRemovingUserId(userId);
    try {
      await apiClient.delete(`/api/trips/${id}/members/${userId}`);
      await loadTrip(id);
    } catch { /* silent */ }
    finally { setRemovingUserId(null); }
  };

  const handleCurrencyChange = async (code: string) => {
    if (!id) return;
    setSavingCurrency(true);
    try {
      await apiClient.patch(`/api/trips/${id}/currency`, { defaultCurrency: code });
      loadTrip(id);
    } catch { /* ignore */ }
    finally { setSavingCurrency(false); }
  };

  const handleAiToggle = async () => {
    if (!id || !currentTrip) return;
    setSavingAi(true);
    try {
      await apiClient.put(`/api/trips/${id}`, {
        aiEnabled: !(currentTrip.aiEnabled !== false),
      });
      await loadTrip(id);
    } catch { /* ignore */ }
    finally { setSavingAi(false); }
  };

  const copyInvite = () => {
    if (!currentTrip) return;
    navigator.clipboard.writeText(`${window.location.origin}/join/${currentTrip.inviteCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || !currentTrip) {
    return (
      <AppShell showBottomNav>
        <div className="text-center py-12 text-neutral-400">טוען...</div>
      </AppShell>
    );
  }

  const myMember = currentTrip.members.find((m) => m.userId === user?.id);
  const isAdmin  = myMember?.role === 'ADMIN';
  const st       = statusInfo(currentTrip.status);

  const hubLinks: { title: string; subtitle: string; path: string }[] = [
    {
      title: '🔗 קישורים והזמנות',
      subtitle: 'טיסות, מלונות, מסמכים ולינקים',
      path: `/trip/${id}/links`,
    },
    {
      title: '📖 ציר זמן',
      subtitle: 'סיפור הטיול והזיכרונות',
      path: `/trip/${id}/timeline`,
    },
  ];

  return (
    <AppShell showBottomNav>

      {/* Trip header */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold text-neutral-900 leading-tight flex-1">{currentTrip.name}</h1>
          {isAdmin && (
            <button
              onClick={openEdit}
              className="flex-shrink-0 text-xs text-brand-500 font-medium px-2.5 py-1.5 rounded-lg bg-brand-50 active:bg-brand-100 mt-0.5"
            >
              ✏️ ערוך
            </button>
          )}
        </div>

        {currentTrip.startDate ? (
          <p className="text-sm text-neutral-500 mt-1">
            📅 {new Date(currentTrip.startDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}
            {currentTrip.endDate && (
              <> — {new Date(currentTrip.endDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</>
            )}
          </p>
        ) : (
          <p className="text-sm text-neutral-400 mt-1">📅 תאריכים טרם נקבעו</p>
        )}

        <div className="mt-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.color}`}>
            {st.label}
          </span>
        </div>
      </div>

      {/* Quick modules */}
      <div className="flex flex-col gap-2 mb-4">
        {hubLinks.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-neutral-200 bg-white hover:border-brand-300 hover:bg-brand-50 transition-colors text-right active:scale-[0.99]"
          >
            <div>
              <p className="text-sm font-semibold text-neutral-800">{item.title}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{item.subtitle}</p>
            </div>
            <span className="text-xs text-brand-500 font-medium flex-shrink-0 mr-2">פתח ←</span>
          </button>
        ))}
      </div>

      {/* Members */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-neutral-800">
            חברי הקבוצה
            <span className="text-sm font-normal text-neutral-400 mr-1.5">({currentTrip.members.length})</span>
          </h2>
          <button
            onClick={copyInvite}
            className="text-xs text-brand-500 font-medium hover:text-brand-700 transition-colors"
          >
            {copied ? '✓ הועתק' : '+ הזמן חבר'}
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {currentTrip.members.map((member) => (
            <div key={member.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Avatar name={member.user.name} avatarUrl={member.user.avatarUrl} size="sm" />
                <span className="text-sm font-medium text-neutral-800">
                  {member.user.name}
                  {member.role === 'ADMIN' && <span className="mr-1 text-xs">👑</span>}
                </span>
              </div>
              {isAdmin && member.userId !== currentTrip.ownerId && member.userId !== user?.id && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleChangeRole(member.userId, member.role)}
                    disabled={changingRoleUserId === member.userId}
                    className="text-xs text-brand-500 px-2 py-1 rounded-lg active:bg-brand-50 disabled:opacity-40"
                  >
                    {changingRoleUserId === member.userId ? '...' : member.role === 'ADMIN' ? 'הסר מנהל' : 'הפוך למנהל'}
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member.userId, member.user.name)}
                    disabled={removingUserId === member.userId}
                    className="text-xs text-red-400 px-2 py-1 rounded-lg active:bg-red-50 disabled:opacity-40"
                  >
                    {removingUserId === member.userId ? '...' : 'הסר'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Switch trip + profile */}
      <div className="flex flex-col gap-2 mb-4">
        <button
          onClick={() => navigate('/', { state: { showDashboard: true } })}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-200 bg-white text-right active:bg-neutral-50"
        >
          <span className="text-sm font-medium text-neutral-700">✈️ החלף טיול</span>
          <span className="text-xs text-brand-500 font-medium">בחר ←</span>
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-200 bg-white text-right active:bg-neutral-50"
        >
          <span className="text-sm font-medium text-neutral-700">👤 הפרופיל שלי</span>
          <span className="text-xs text-brand-500 font-medium">פתח ←</span>
        </button>
      </div>

      {/* Admin tools */}
      {isAdmin && (
        <div className="mt-2 pt-5 border-t border-neutral-100">
          <p className="text-xs text-neutral-400 mb-3 font-medium">כלי מנהל</p>

          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-200 bg-white mb-2">
            <div className="min-w-0 pr-3">
              <p className="text-sm text-neutral-700 font-medium">🤖 AI בטיול</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">סיכומי ציר זמן + התראות חכמות</p>
            </div>
            <button
              type="button"
              onClick={handleAiToggle}
              disabled={savingAi}
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                currentTrip.aiEnabled !== false ? 'bg-brand-500' : 'bg-neutral-200'
              } disabled:opacity-50`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  currentTrip.aiEnabled !== false ? 'right-0.5' : 'right-5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-200 bg-white">
            <span className="text-sm text-neutral-600">💱 מטבע ברירת מחדל</span>
            <select
              value={currentTrip.defaultCurrency}
              onChange={e => handleCurrencyChange(e.target.value)}
              disabled={savingCurrency}
              className="text-sm font-medium text-brand-600 bg-transparent border-none outline-none cursor-pointer disabled:opacity-50"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Edit trip sheet */}
      {editOpen && (
        <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditOpen(false)} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl p-6 pb-10">
            <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-bold text-neutral-900 mb-5">עריכת פרטי הטיול</h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-neutral-600 mb-1.5 block">שם הטיול</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-neutral-600 mb-1.5 block">תאריך יציאה</label>
                  <input
                    type="date"
                    value={editStart}
                    onChange={e => setEditStart(e.target.value)}
                    className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-neutral-600 mb-1.5 block">תאריך חזרה</label>
                  <input
                    type="date"
                    value={editEnd}
                    onChange={e => setEditEnd(e.target.value)}
                    className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-600 mb-2 block">סטטוס</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setEditStatus(s.value)}
                      className={`py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                        editStatus === s.value
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-neutral-200 text-neutral-600'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveEdit}
              disabled={saving || !editName.trim()}
              className="w-full mt-6 bg-brand-500 text-white font-bold py-3.5 rounded-2xl active:bg-brand-600 disabled:opacity-50"
            >
              {saving ? 'שומר...' : 'שמור שינויים'}
            </button>
          </div>
        </div>
      )}

    </AppShell>
  );
};
