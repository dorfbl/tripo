import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import apiClient from '../api/client';
import type { Decision, DecisionType, DecisionCategory } from '../types';

const CATEGORIES: { value: DecisionCategory; label: string }[] = [
  { value: 'DESTINATION', label: 'יעד' },
  { value: 'DATES', label: 'תאריכים' },
  { value: 'HOTEL', label: 'לינה' },
  { value: 'TRANSPORT', label: 'תחבורה' },
  { value: 'ACTIVITY', label: 'אטרקציות' },
  { value: 'BUDGET', label: 'תקציב' },
  { value: 'OTHER', label: 'אחר' },
];

const TYPES: { value: DecisionType; label: string; description: string }[] = [
  { value: 'SINGLE_CHOICE', label: 'בחירה אחת',   description: 'כל אחד בוחר אפשרות אחת' },
  { value: 'MULTI_CHOICE',  label: 'כמה בחירות', description: 'כל אחד יכול לסמן כמה אפשרויות' },
  { value: 'YES_NO',        label: 'כן / לא',     description: 'הצבעה פשוטה — האם כן או לא' },
  { value: 'TOP3',          label: 'טופ 3',        description: 'כל אחד מדרג את ה-3 המועדפים מתוך הרשימה' },
];

export const CreateDecisionPage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<DecisionType>('SINGLE_CHOICE');
  const [category, setCategory] = useState<DecisionCategory>('OTHER');
  const [options, setOptions] = useState(['', '']);
  const [isSecretVote, setIsSecretVote] = useState(false);
  const [hideResultsUntilClosed, setHideResultsUntilClosed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateOption = (i: number, val: string) =>
    setOptions(prev => prev.map((o, idx) => idx === i ? val : o));
  const addOption = () => setOptions(prev => [...prev, '']);
  const removeOption = (i: number) => setOptions(prev => prev.filter((_, idx) => idx !== i));

  const showOptions = type === 'SINGLE_CHOICE' || type === 'MULTI_CHOICE' || type === 'TOP3';

  const handleSubmit = async () => {
    if (!title.trim()) { setError('כותרת שדה חובה'); return; }
    if (!tripId) return;
    setSaving(true);
    setError('');
    try {
      const opts = showOptions ? options.map(o => o.trim()).filter(Boolean) : [];
      const { data } = await apiClient.post<Decision>(`/api/decisions/${tripId}`, {
        title: title.trim(),
        description: description.trim() || null,
        type,
        category,
        options: opts,
        isSecretVote,
        hideResultsUntilClosed,
      });
      navigate(`/trip/${tripId}/plan/decisions`, { state: { newDecisionId: data.id } });
    } catch {
      setError('שגיאה ביצירת ההחלטה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-4 pb-32">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-neutral-500 mb-5 active:text-neutral-800"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          חזרה
        </button>

        <h1 className="text-2xl font-bold text-neutral-900 mb-1">החלטה חדשה</h1>
        <p className="text-sm text-neutral-500 mb-6">מה צריך לסגור לטיול?</p>

        <div className="flex flex-col gap-5">

          {/* Title */}
          <div>
            <label className="text-sm font-bold text-neutral-700 mb-1.5 block">כותרת *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder='לדוגמה: איזה מלון סוגרים?'
              className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 bg-white"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-bold text-neutral-700 mb-1.5 block">תיאור קצר <span className="font-normal text-neutral-400">(אופציונלי)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="הקשר נוסף לשאר הקבוצה..."
              rows={3}
              className="w-full border border-neutral-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 resize-none bg-white"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-sm font-bold text-neutral-700 mb-2 block">סוג ההצבעה</label>
            <div className="flex flex-col gap-2">
              {TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`text-right px-4 py-3 rounded-2xl border transition-colors ${
                    type === t.value
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-neutral-200 bg-white'
                  }`}
                >
                  <div className={`text-sm font-bold ${type === t.value ? 'text-brand-700' : 'text-neutral-800'}`}>
                    {t.label}
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-bold text-neutral-700 mb-2 block">קטגוריה</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`text-xs font-bold px-4 py-2 rounded-full border transition-colors ${
                    category === c.value
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-white text-neutral-600 border-neutral-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          {showOptions && (
            <div>
              <label className="text-sm font-bold text-neutral-700 mb-2 block">
                אפשרויות{' '}
                <span className="font-normal text-neutral-400">
                  {type === 'TOP3' ? '(צריך לפחות 4 כדי לדרג 3)' : '(אפשר להוסיף עוד אחרי)'}
                </span>
              </label>
              <div className="flex flex-col gap-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={opt}
                      onChange={e => updateOption(i, e.target.value)}
                      placeholder={`אפשרות ${i + 1}`}
                      className="flex-1 border border-neutral-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 bg-white"
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => removeOption(i)}
                        className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-red-500 rounded-full"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {options.length < 8 && (
                  <button
                    onClick={addOption}
                    className="text-sm text-brand-600 font-bold py-2.5 rounded-2xl border border-dashed border-brand-300 active:bg-brand-50"
                  >
                    + הוסף אפשרות
                  </button>
                )}
              </div>
            </div>
          )}

          {/* YES_NO / TOP3 note */}
          {type === 'YES_NO' && (
            <p className="text-xs text-neutral-400 text-center -mt-2">אפשרויות "כן" ו"לא" יתווספו אוטומטית</p>
          )}
          {type === 'TOP3' && (
            <p className="text-xs text-neutral-400 text-center -mt-2">הוסף לפחות 4 אפשרויות — כל משתתף יבחר את ה-3 הטובים</p>
          )}

          {/* Secret vote toggle */}
          <div className="flex items-center justify-between py-3 border-t border-neutral-100">
            <div>
              <p className="text-sm font-bold text-neutral-800 flex items-center gap-1.5">
                <span>👤</span>
                {isSecretVote ? 'הצבעה חשאית' : 'הצבעה גלויה'}
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isSecretVote ? 'לא יוצג מי הצביע על מה' : 'כולם רואים מי הצביע על מה'}
              </p>
            </div>
            <button
              onClick={() => setIsSecretVote(p => !p)}
              className={`relative w-12 h-6 rounded-full transition-colors ${isSecretVote ? 'bg-brand-500' : 'bg-neutral-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isSecretVote ? 'translate-x-0.5' : 'translate-x-6'}`} />
            </button>
          </div>

          {/* Hide results until closed toggle */}
          <div className="flex items-center justify-between py-3 border-t border-neutral-100">
            <div>
              <p className="text-sm font-bold text-neutral-800 flex items-center gap-1.5">
                <span>🔒</span>
                {hideResultsUntilClosed ? 'תוצאות מוסתרות' : 'תוצאות גלויות'}
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">
                {hideResultsUntilClosed ? 'התוצאות יוצגו רק לאחר סגירת ההצבעה' : 'כולם רואים את הספירה בזמן אמת'}
              </p>
            </div>
            <button
              onClick={() => setHideResultsUntilClosed(p => !p)}
              className={`relative w-12 h-6 rounded-full transition-colors ${hideResultsUntilClosed ? 'bg-brand-500' : 'bg-neutral-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${hideResultsUntilClosed ? 'translate-x-0.5' : 'translate-x-6'}`} />
            </button>
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        </div>

        {/* Submit */}
        <div className="fixed bottom-0 right-0 left-0 bg-white border-t border-neutral-100 px-4 pt-3 pb-8">
          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className="w-full bg-brand-500 text-white font-bold py-4 rounded-2xl active:bg-brand-600 disabled:opacity-50 text-base"
          >
            {saving ? 'יוצר...' : 'צור החלטה'}
          </button>
        </div>
      </div>
    </AppShell>
  );
};
