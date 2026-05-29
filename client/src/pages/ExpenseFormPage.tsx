import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';

// ─── קבועים ────────────────────────────────────────────────────────────────────
const CURRENCIES: { code: string; symbol: string; label: string; defaultRate: number }[] = [
  { code: 'ILS', symbol: '₪', label: 'שקל (₪)',        defaultRate: 1     },
  { code: 'USD', symbol: '$', label: 'דולר ($)',        defaultRate: 3.70  },
  { code: 'EUR', symbol: '€', label: 'אירו (€)',        defaultRate: 4.05  },
  { code: 'GBP', symbol: '£', label: 'פאונד (£)',       defaultRate: 4.75  },
  { code: 'CHF', symbol: '₣', label: 'פרנק שוויצרי',   defaultRate: 4.20  },
  { code: 'JPY', symbol: '¥', label: 'ין יפני (¥)',     defaultRate: 0.025 },
  { code: 'THB', symbol: '฿', label: 'באט תאילנדי (฿)', defaultRate: 0.106 },
  { code: 'CZK', symbol: 'Kč',label: 'קורונה צ׳כית',   defaultRate: 0.165 },
  { code: 'HUF', symbol: 'Ft',label: 'פורינט הונגרי',   defaultRate: 0.010 },
  { code: 'PLN', symbol: 'zł',label: 'זלוטי פולני (zł)', defaultRate: 0.95 },
  { code: 'AUD', symbol: 'A$',label: 'דולר אוסטרלי',   defaultRate: 2.40  },
  { code: 'CAD', symbol: 'C$',label: 'דולר קנדי',       defaultRate: 2.70  },
];

const CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: 'food',          label: 'אוכל ושתייה',  emoji: '🍽️' },
  { id: 'accommodation', label: 'לינה',         emoji: '🏨' },
  { id: 'transport',     label: 'תחבורה',       emoji: '🚗' },
  { id: 'activities',    label: 'פעילויות',      emoji: '🎭' },
  { id: 'shopping',      label: 'קניות',         emoji: '🛍️' },
  { id: 'health',        label: 'בריאות',        emoji: '💊' },
  { id: 'other',         label: 'אחר',           emoji: '📌' },
];

// ─── טיפוסים ───────────────────────────────────────────────────────────────────
interface Member { id: string; name: string }
interface TripMemberFull { userId: string; role: string; user: Member }
interface Participant { userId: string; user: Member }
interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  amountILS: number;
  paidBy: Member;
  participants: Participant[];
  expenseDate: string;
}

// ─── עזרים ────────────────────────────────────────────────────────────────────
const fmtILS = (n: number) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);

const todayStr = () => new Date().toISOString().slice(0, 10);

// ─── ExpenseFormPage ──────────────────────────────────────────────────────────
export const ExpenseFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: tripId, expenseId } = useParams<{ id: string; expenseId?: string }>();
  const { user } = useAuthStore();
  const isEdit = !!expenseId;

  const [members,  setMembers]  = useState<TripMemberFull[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  // ─── ערכי טופס ────────────────────────────────────────────────────────────
  const [description,  setDescription]  = useState('');
  const [category,     setCategory]     = useState('other');
  const [paidByUserId, setPaidBy]       = useState('');
  const [amount,       setAmount]       = useState('');
  const [currency,     setCurrency]     = useState('ILS');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [expenseDate,  setExpenseDate]  = useState(todayStr());
  const [participants, setParticipants] = useState<string[]>([]);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  const curInfo   = CURRENCIES.find(c => c.code === currency)!;
  const amountILS = amount ? Math.round(parseFloat(amount) * exchangeRate * 100) / 100 : 0;

  // ─── טעינה ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tripId) return;
    const init = async () => {
      try {
        // טוען חברים + הוצאה קיימת (אם עריכה)
        const [expRes, membRes] = await Promise.all([
          isEdit
            ? apiClient.get(`/api/expenses/${tripId}`).then(r =>
                (r.data.expenses as Expense[]).find((e: Expense) => e.id === expenseId) ?? null
              )
            : Promise.resolve(null),
          apiClient.get(`/api/expenses/${tripId}`).then(r => r.data.members as TripMemberFull[]),
        ]);

        const membs: TripMemberFull[] = membRes;
        setMembers(membs);

        if (isEdit && expRes) {
          const exp = expRes as Expense;
          setDescription(exp.description);
          setCategory(exp.category);
          setPaidBy(exp.paidBy.id);
          setAmount(String(exp.amount));
          setCurrency(exp.currency);
          setExchangeRate(exp.exchangeRate);
          setExpenseDate(exp.expenseDate.slice(0, 10));
          setParticipants(exp.participants.map(p => p.userId));
        } else {
          setPaidBy(user?.id ?? '');
          setParticipants(membs.map(m => m.userId));
        }
      } catch { /* ignore */ }
      finally { setLoadingInit(false); }
    };
    init();
  }, [tripId, expenseId, isEdit, user?.id]);

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    setExchangeRate(CURRENCIES.find(c => c.code === code)?.defaultRate ?? 1);
  };

  const toggleParticipant = (uid: string) => {
    setParticipants(prev =>
      prev.includes(uid) ? prev.filter(p => p !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!description.trim())     { setError('חובה להזין תיאור'); return; }
    if (!amount || +amount <= 0) { setError('חובה להזין סכום חיובי'); return; }
    if (!participants.length)    { setError('חובה לבחור לפחות משתתף אחד'); return; }

    setSaving(true);
    try {
      const payload = {
        description, category, paidByUserId,
        amount: parseFloat(amount),
        currency, exchangeRate,
        expenseDate,
        participantIds: participants,
      };
      if (isEdit) {
        await apiClient.put(`/api/expenses/${expenseId}`, payload);
      } else {
        await apiClient.post(`/api/expenses/${tripId}`, payload);
      }
      navigate(`/trip/${tripId}/expenses`, { replace: true });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? (isEdit ? 'שגיאה בעדכון' : 'שגיאה בהוספה'));
      setSaving(false);
    }
  };

  if (loadingInit) {
    return (
      <AppShell showBottomNav>
        <div className="text-center py-12 text-neutral-400">טוען...</div>
      </AppShell>
    );
  }

  return (
    <AppShell showBottomNav>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 active:bg-neutral-200 transition-colors flex-shrink-0"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-neutral-900">
          {isEdit ? '✏️ עריכת הוצאה' : '➕ הוצאה חדשה'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* תיאור */}
        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-1.5">תיאור</label>
          <input
            className="w-full border border-neutral-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="למשל: ארוחת ערב, מונית לשדה..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            autoFocus
          />
        </div>

        {/* תאריך */}
        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-1.5">תאריך</label>
          <input
            type="date"
            className="w-1/2 min-w-0 border border-neutral-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            value={expenseDate}
            onChange={e => setExpenseDate(e.target.value)}
          />
        </div>

        {/* קטגוריה */}
        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-2">קטגוריה</label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs transition-all ${
                  category === cat.id
                    ? 'border-brand-500 bg-brand-50 text-brand-600 font-medium'
                    : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                }`}
              >
                <span className="text-xl">{cat.emoji}</span>
                <span className="leading-tight text-center">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* מי שילם */}
        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-1.5">מי שילם?</label>
          <select
            className="w-full border border-neutral-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            value={paidByUserId}
            onChange={e => setPaidBy(e.target.value)}
          >
            {members.map(m => (
              <option key={m.userId} value={m.userId}>
                {m.user.name}{m.userId === user?.id ? ' (אני)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* סכום + מטבע */}
        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-1.5">סכום</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              className="flex-1 border border-neutral-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              inputMode="decimal"
            />
            <select
              className="w-36 border border-neutral-200 rounded-xl px-2 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              value={currency}
              onChange={e => handleCurrencyChange(e.target.value)}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>
              ))}
            </select>
          </div>
        </div>

        {/* שער המרה */}
        {currency !== 'ILS' && (
          <div className="bg-neutral-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-neutral-600">
                שער המרה: 1 {curInfo.symbol} =
              </label>
              <span className="text-xs text-neutral-400">ניתן לשינוי</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                className="w-28 border border-neutral-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                value={exchangeRate}
                onChange={e => setExchangeRate(parseFloat(e.target.value) || 0)}
                inputMode="decimal"
              />
              <span className="text-sm text-neutral-600">₪</span>
              {amountILS > 0 && (
                <span className="text-xs text-neutral-500 mr-auto">
                  ≈ {fmtILS(amountILS)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* משתתפים */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-neutral-700">מחולק בין</label>
            <button
              type="button"
              className="text-xs text-brand-500"
              onClick={() => setParticipants(
                participants.length === members.length ? [] : members.map(m => m.userId)
              )}
            >
              {participants.length === members.length ? 'בטל הכל' : 'בחר הכל'}
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {members.map(m => (
              <label key={m.userId} className="flex items-center gap-3 cursor-pointer py-1">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-brand-500"
                  checked={participants.includes(m.userId)}
                  onChange={() => toggleParticipant(m.userId)}
                />
                <span className="text-sm text-neutral-800 flex-1">
                  {m.user.name}{m.userId === user?.id ? ' (אני)' : ''}
                </span>
                {participants.includes(m.userId) && participants.length > 0 && amountILS > 0 && (
                  <span className="text-xs text-neutral-400">
                    {fmtILS(amountILS / participants.length)}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <Button type="submit" size="lg" className="w-full" loading={saving}>
          {isEdit ? 'שמור שינויים' : 'הוסף הוצאה'}
        </Button>

        <div className="h-2" />
      </form>
    </AppShell>
  );
};
