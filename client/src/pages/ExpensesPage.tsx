import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';

// ─── קבועים ────────────────────────────────────────────────────────────────────
const CURRENCIES: { code: string; symbol: string; label: string; defaultRate: number }[] = [
  { code: 'ILS', symbol: '₪', label: 'שקל (₪)',       defaultRate: 1     },
  { code: 'USD', symbol: '$', label: 'דולר ($)',       defaultRate: 3.70  },
  { code: 'EUR', symbol: '€', label: 'אירו (€)',       defaultRate: 4.05  },
  { code: 'GBP', symbol: '£', label: 'פאונד (£)',      defaultRate: 4.75  },
  { code: 'CHF', symbol: '₣', label: 'פרנק שוויצרי',  defaultRate: 4.20  },
  { code: 'JPY', symbol: '¥', label: 'ין יפני (¥)',    defaultRate: 0.025 },
  { code: 'THB', symbol: '฿', label: 'באט תאילנדי (฿)',defaultRate: 0.106 },
  { code: 'CZK', symbol: 'Kč',label: 'קורונה צ׳כית',  defaultRate: 0.165 },
  { code: 'HUF', symbol: 'Ft',label: 'פורינט הונגרי',  defaultRate: 0.010 },
  { code: 'PLN', symbol: 'zł',label: 'זלוטי פולני (zł)',defaultRate: 0.95 },
  { code: 'AUD', symbol: 'A$',label: 'דולר אוסטרלי',  defaultRate: 2.40  },
  { code: 'CAD', symbol: 'C$',label: 'דולר קנדי',      defaultRate: 2.70  },
];

const CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: 'food',          label: 'אוכל ושתייה',    emoji: '🍽️' },
  { id: 'accommodation', label: 'לינה',           emoji: '🏨' },
  { id: 'transport',     label: 'תחבורה',         emoji: '🚗' },
  { id: 'activities',    label: 'פעילויות',        emoji: '🎭' },
  { id: 'shopping',      label: 'קניות',           emoji: '🛍️' },
  { id: 'health',        label: 'בריאות',          emoji: '💊' },
  { id: 'other',         label: 'אחר',             emoji: '📌' },
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
  createdAt: string;
}
interface Settlement {
  from: Member;
  to:   Member;
  amountILS: number;
}

// ─── עזרים ────────────────────────────────────────────────────────────────────
const fmtILS = (n: number) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);

const fmtAmt = (amount: number, currency: string) => {
  const cur = CURRENCIES.find(c => c.code === currency);
  const sym = cur?.symbol ?? currency;
  if (currency === 'ILS') return `${amount.toLocaleString('he-IL', { maximumFractionDigits: 0 })} ₪`;
  return `${sym}${amount.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
};

const catInfo = (id: string) => CATEGORIES.find(c => c.id === id) ?? { emoji: '📌', label: 'אחר' };

// ─── קומפוננט ExpenseModal (הוספה + עריכה) ────────────────────────────────────
interface ModalProps {
  tripId:       string;
  members:      TripMemberFull[];
  myUserId:     string;
  editExpense?: Expense;          // אם מסופק — מצב עריכה
  onClose:      () => void;
  onSaved:      (exp: Expense) => void;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const ExpenseModal: React.FC<ModalProps> = ({ tripId, members, myUserId, editExpense, onClose, onSaved }) => {
  const isEdit = !!editExpense;

  const [description,  setDescription]  = useState(editExpense?.description ?? '');
  const [category,     setCategory]     = useState(editExpense?.category ?? 'other');
  const [paidByUserId, setPaidBy]       = useState(editExpense?.paidBy.id ?? myUserId);
  const [amount,       setAmount]       = useState(editExpense ? String(editExpense.amount) : '');
  const [currency,     setCurrency]     = useState(editExpense?.currency ?? 'ILS');
  const [exchangeRate, setExchangeRate] = useState(editExpense?.exchangeRate ?? 1);
  const [expenseDate,  setExpenseDate]  = useState(
    editExpense?.expenseDate ? editExpense.expenseDate.slice(0, 10) : todayStr()
  );
  const [participants, setParticipants] = useState<string[]>(
    editExpense ? editExpense.participants.map(p => p.userId) : members.map(m => m.userId)
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const curInfo   = CURRENCIES.find(c => c.code === currency)!;
  const amountILS = amount ? Math.round(parseFloat(amount) * exchangeRate * 100) / 100 : 0;

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    if (!editExpense || code !== editExpense.currency) {
      setExchangeRate(CURRENCIES.find(c => c.code === code)?.defaultRate ?? 1);
    }
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
      const res = isEdit
        ? await apiClient.put(`/api/expenses/${editExpense!.id}`, payload)
        : await apiClient.post(`/api/expenses/${tripId}`, payload);
      onSaved(res.data.expense);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? (isEdit ? 'שגיאה בעדכון' : 'שגיאה בהוספה'));
    } finally {
      setSaving(false);
    }
  };

  // ─── מבנה נכון: overlay קבוע + sheet flex-col + header דביק + גוף גלילה ───
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
      onTouchMove={e => e.preventDefault()}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white w-full rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '90dvh' }}
        onTouchMove={e => e.stopPropagation()}
      >
        {/* Header דביק */}
        <div className="flex-shrink-0 border-b border-neutral-100 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-neutral-900 text-lg">{isEdit ? '✏️ עריכת הוצאה' : '➕ הוצאה חדשה'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-2xl leading-none">×</button>
        </div>

        {/* גוף גלילה */}
        <div className="overflow-y-auto overscroll-contain flex-1">
          <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">

            {/* תיאור */}
            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-1">תיאור</label>
              <input
                className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="למשל: ארוחת ערב ברסטורנט, מונית לשדה..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* תאריך */}
            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-1">תאריך</label>
              <input
                type="date"
                className="w-full min-w-0 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
              />
            </div>

            {/* קטגוריה */}
            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-1.5">קטגוריה</label>
              <div className="grid grid-cols-4 gap-1.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border text-xs transition-all ${
                      category === cat.id
                        ? 'border-brand-500 bg-brand-50 text-brand-600 font-medium'
                        : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                    }`}
                  >
                    <span className="text-lg">{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* מי שילם */}
            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-1">מי שילם?</label>
              <select
                className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                value={paidByUserId}
                onChange={e => setPaidBy(e.target.value)}
              >
                {members.map(m => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name}{m.userId === myUserId ? ' (אני)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* סכום + מטבע */}
            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-1">סכום</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="flex-1 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
                <select
                  className="w-36 border border-neutral-200 rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={currency}
                  onChange={e => handleCurrencyChange(e.target.value)}
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* שער המרה (אם לא שקל) */}
            {currency !== 'ILS' && (
              <div className="bg-neutral-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
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
                    className="w-28 border border-neutral-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                    value={exchangeRate}
                    onChange={e => setExchangeRate(parseFloat(e.target.value) || 0)}
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
              <div className="flex items-center justify-between mb-1.5">
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
              <div className="flex flex-col gap-1.5">
                {members.map(m => (
                  <label key={m.userId} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-brand-500"
                      checked={participants.includes(m.userId)}
                      onChange={() => toggleParticipant(m.userId)}
                    />
                    <span className="text-sm text-neutral-800">
                      {m.user.name}{m.userId === myUserId ? ' (אני)' : ''}
                    </span>
                    {participants.includes(m.userId) && participants.length > 0 && (
                      <span className="text-xs text-neutral-400 mr-auto">
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

            {/* padding תחתון לבטיחות ב-iOS */}
            <div className="h-4" />
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── קומפוננט ראשי ────────────────────────────────────────────────────────────
export const ExpensesPage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const { user } = useAuthStore();

  const [expenses,    setExpenses]    = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [members,     setMembers]     = useState<TripMemberFull[]>([]);
  const [totalILS,    setTotalILS]    = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [editingExpense,setEditingExpense] = useState<Expense | null>(null);
  const [activeTab,     setActiveTab]     = useState<'expenses' | 'settlements'>('expenses');
  const [deleting,    setDeleting]    = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      const res = await apiClient.get(`/api/expenses/${tripId}`);
      setExpenses(res.data.expenses);
      setSettlements(res.data.settlements);
      setMembers(res.data.members);
      setTotalILS(res.data.totalILS);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load, tripId]);

  const handleSaved = (_exp: Expense) => {
    setShowModal(false);
    setEditingExpense(null);
    load(); // טעינה מחדש לעדכון settlements ו-totalILS
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm('למחוק הוצאה זו?')) return;
    setDeleting(expenseId);
    try {
      await apiClient.delete(`/api/expenses/${expenseId}`);
      load();
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  };

  if (loading) {
    return <AppShell showBottomNav><div className="text-center py-12 text-neutral-400">טוען...</div></AppShell>;
  }

  return (
    <AppShell showBottomNav>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">💸 הוצאות</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {expenses.length} הוצאות • סה״כ {fmtILS(totalILS)}
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditingExpense(null); setShowModal(true); }}>+ הוצאה</Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 mb-4">
        {(['expenses', 'settlements'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab === 'expenses' ? `📋 הוצאות (${expenses.length})` : `⚖️ סילוקין (${settlements.length})`}
          </button>
        ))}
      </div>

      {/* ─── TAB: הוצאות ─── */}
      {activeTab === 'expenses' && (
        <div className="flex flex-col gap-3">
          {expenses.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <div className="text-4xl mb-3">💸</div>
              <p className="font-medium">אין הוצאות עדיין</p>
              <p className="text-sm mt-1">לחץ + הוצאה כדי להתחיל לעקוב</p>
            </div>
          ) : (
            expenses.map(exp => {
              const cat = catInfo(exp.category);
              const canDelete = exp.paidBy.id === user?.id ||
                members.find(m => m.userId === user?.id)?.role === 'ADMIN'; // role ב-TripMemberFull
              return (
                <Card key={exp.id} className="p-4">
                  <div className="flex items-start gap-3">
                    {/* אמוג'י קטגוריה */}
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-xl flex-shrink-0">
                      {cat.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-neutral-900 text-sm leading-snug">
                          {exp.description}
                        </span>
                        <div className="text-left flex-shrink-0">
                          <div className="font-bold text-neutral-900 text-sm">
                            {fmtAmt(exp.amount, exp.currency)}
                          </div>
                          {exp.currency !== 'ILS' && (
                            <div className="text-xs text-neutral-400">{fmtILS(exp.amountILS)}</div>
                          )}
                        </div>
                      </div>

                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-neutral-500">
                          שילם: <span className="font-medium text-neutral-700">{exp.paidBy.name}</span>
                        </span>
                        <span className="text-xs text-neutral-300">•</span>
                        <span className="text-xs text-neutral-500">
                          מחולק ל-{exp.participants.length}
                          {exp.participants.length > 0 && (
                            <span className="text-neutral-400">
                              {' '}({fmtILS(exp.amountILS / exp.participants.length)} לאחד)
                            </span>
                          )}
                        </span>
                      </div>

                      {/* משתתפים */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {exp.participants.map(p => (
                          <span key={p.userId} className="text-xs bg-neutral-100 text-neutral-600 rounded-full px-2 py-0.5">
                            {p.user.name}
                          </span>
                        ))}
                      </div>

                      {/* תאריך + עריכה + מחיקה */}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-neutral-400">
                          {new Date(exp.expenseDate).toLocaleDateString('he-IL')}
                        </span>
                        {canDelete && (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => { setEditingExpense(exp); setShowModal(true); }}
                              className="text-xs text-brand-500 hover:text-brand-700 transition-colors"
                            >
                              ✏️ ערוך
                            </button>
                            <button
                              onClick={() => handleDelete(exp.id)}
                              disabled={deleting === exp.id}
                              className="text-xs text-red-400 hover:text-red-600 transition-colors"
                            >
                              {deleting === exp.id ? '...' : 'מחק'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ─── TAB: סילוקין ─── */}
      {activeTab === 'settlements' && (
        <div className="flex flex-col gap-3">
          {/* סיכום יתרות */}
          <Card className="p-4">
            <h3 className="font-semibold text-neutral-800 mb-3">יתרות לפי חבר</h3>
            <div className="flex flex-col gap-2">
              {members.map(m => {
                // חשב יתרה של חבר זה
                let net = 0;
                for (const exp of expenses) {
                  const parts = exp.participants.map(p => p.userId);
                  if (!parts.length) continue;
                  const share = exp.amountILS / parts.length;
                  if (exp.paidBy.id === m.userId) net += exp.amountILS;
                  if (parts.includes(m.userId))   net -= share;
                }
                const rounded = Math.round(net * 100) / 100;
                return (
                  <div key={m.userId} className="flex items-center justify-between">
                    <span className="text-sm text-neutral-800">{m.user.name}</span>
                    <span className={`text-sm font-semibold ${
                      rounded > 0.5 ? 'text-green-600' :
                      rounded < -0.5 ? 'text-red-500' :
                      'text-neutral-400'
                    }`}>
                      {rounded > 0.5  ? `+${fmtILS(rounded)}` :
                       rounded < -0.5 ? `-${fmtILS(-rounded)}` :
                       'מאוזן ✓'}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* עסקאות לסילוק */}
          <h3 className="font-semibold text-neutral-800 mt-1">תשלומים לסילוק חובות</h3>
          {settlements.length === 0 ? (
            <Card className="p-6 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="font-medium text-neutral-700">הכל מסודר! אין חובות לסלק</p>
              <p className="text-sm text-neutral-400 mt-1">
                {expenses.length === 0 ? 'עדיין לא הוזנו הוצאות' : 'כולם משלמים שווה בשווה'}
              </p>
            </Card>
          ) : (
            settlements.map((s, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-neutral-900">{s.from.name}</span>
                      <span className="text-neutral-400 text-sm">←</span>
                      <span className="font-semibold text-neutral-900">{s.to.name}</span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {s.from.name} משלם ל{s.to.name}
                    </p>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-lg text-brand-600">{fmtILS(s.amountILS)}</div>
                  </div>
                </div>
              </Card>
            ))
          )}

          {settlements.length > 0 && (
            <p className="text-xs text-neutral-400 text-center mt-1">
              * חישוב אופטימלי — מינימום מספר תשלומים לסילוק כל החובות
            </p>
          )}
        </div>
      )}

      {showModal && (
        <ExpenseModal
          tripId={tripId!}
          members={members}
          myUserId={user!.id}
          editExpense={editingExpense ?? undefined}
          onClose={() => { setShowModal(false); setEditingExpense(null); }}
          onSaved={handleSaved}
        />
      )}
    </AppShell>
  );
};
