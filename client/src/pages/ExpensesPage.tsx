import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';

// ─── קבועים ────────────────────────────────────────────────────────────────────
const CURRENCIES: { code: string; symbol: string }[] = [
  { code: 'ILS', symbol: '₪'  },
  { code: 'USD', symbol: '$'  },
  { code: 'EUR', symbol: '€'  },
  { code: 'GBP', symbol: '£'  },
  { code: 'CHF', symbol: '₣'  },
  { code: 'JPY', symbol: '¥'  },
  { code: 'THB', symbol: '฿'  },
  { code: 'CZK', symbol: 'Kč' },
  { code: 'HUF', symbol: 'Ft' },
  { code: 'PLN', symbol: 'zł' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
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

// ─── קומפוננט ראשי ────────────────────────────────────────────────────────────
export const ExpensesPage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [expenses,    setExpenses]    = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [members,     setMembers]     = useState<TripMemberFull[]>([]);
  const [totalILS,    setTotalILS]    = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<'expenses' | 'settlements'>('expenses');
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

  useEffect(() => { load(); }, [load, tripId]);

  // רענון כשחוזרים לדף (iOS PWA)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
    };
  }, [load]);

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
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-neutral-900">💸 הוצאות</h1>
        <p className="text-sm text-neutral-400 mt-0.5">
          {expenses.length} הוצאות • סה״כ {fmtILS(totalILS)}
        </p>
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
              <p className="text-sm mt-1">לחץ + כדי להוסיף הוצאה</p>
            </div>
          ) : (
            expenses.map(exp => {
              const cat = catInfo(exp.category);
              const canDelete = exp.paidBy.id === user?.id ||
                members.find(m => m.userId === user?.id)?.role === 'ADMIN';
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
                              onClick={() => navigate(`/trip/${tripId}/expenses/edit/${exp.id}`)}
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

      {/* FAB — הוצאה חדשה */}
      <button
        className="fixed z-40 w-14 h-14 bg-brand-500 text-white rounded-full shadow-xl flex items-center justify-center active:bg-brand-600 transition-colors"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)', left: '50%', transform: 'translateX(-50%)' }}
        onClick={() => navigate(`/trip/${tripId}/expenses/new`)}
        aria-label="הוסף הוצאה"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

    </AppShell>
  );
};
