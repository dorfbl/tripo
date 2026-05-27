import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';
import apiClient from '../api/client';
import type { Question } from '../types';

const ADMIN_EMAIL = 'dorfbl@gmail.com';

const TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: 'בחירה יחידה',
  MULTI_CHOICE: 'בחירה מרובה',
  SCALE: 'סקאלה',
  TEXT: 'טקסט חופשי',
};

const CATEGORIES = ['סגנון נסיעה', 'פעילויות', 'לוגיסטיקה', 'דינמיקה קבוצתית', 'אישיות'];

type QuestionType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'SCALE' | 'TEXT';

interface FormState {
  text: string;
  category: string;
  type: QuestionType;
  order: number;
  isActive: boolean;
  // SINGLE/MULTI options
  choiceOptions: string[];
  // SCALE labels
  scaleLow: string;
  scaleHigh: string;
}

const emptyForm = (): FormState => ({
  text: '',
  category: 'סגנון נסיעה',
  type: 'SINGLE_CHOICE',
  order: 1,
  isActive: true,
  choiceOptions: ['', ''],
  scaleLow: '',
  scaleHigh: '',
});

function questionToForm(q: Question): FormState {
  const opts = q.options as string[] | null;
  return {
    text: q.text,
    category: q.category,
    type: q.type as QuestionType,
    order: q.order,
    isActive: q.isActive,
    choiceOptions: q.type === 'SINGLE_CHOICE' || q.type === 'MULTI_CHOICE'
      ? (opts ?? ['', ''])
      : ['', ''],
    scaleLow: q.type === 'SCALE' ? (opts?.[0] ?? '') : '',
    scaleHigh: q.type === 'SCALE' ? (opts?.[4] ?? '') : '',
  };
}

function formToOptions(f: FormState): string[] | null {
  if (f.type === 'TEXT') return null;
  if (f.type === 'SCALE') return [f.scaleLow, '', '', '', f.scaleHigh];
  return f.choiceOptions.filter(o => o.trim() !== '');
}

export const AdminQuestionsPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // which row is editing; null = adding new
  const [editingId, setEditingId] = useState<string | null | 'new'>(undefined as unknown as null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/admin/questions');
      setQuestions(res.data.questions);
    } catch {
      setError('שגיאה בטעינת שאלות');
    } finally {
      setLoading(false);
    }
  };

  const startAdd = () => {
    setForm(emptyForm());
    setFormError('');
    setEditingId('new');
  };

  const startEdit = (q: Question) => {
    setForm(questionToForm(q));
    setFormError('');
    setEditingId(q.id);
  };

  const cancelEdit = () => setEditingId(undefined as unknown as null);

  const handleSave = async () => {
    if (!form.text.trim()) { setFormError('טקסט השאלה חובה'); return; }
    if (!form.category.trim()) { setFormError('קטגוריה חובה'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        text: form.text,
        category: form.category,
        type: form.type,
        order: form.order,
        isActive: form.isActive,
        options: formToOptions(form),
      };
      if (editingId === 'new') {
        await apiClient.post('/api/admin/questions', payload);
      } else {
        await apiClient.put(`/api/admin/questions/${editingId}`, payload);
      }
      cancelEdit();
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'שגיאה בשמירה';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (q: Question) => {
    try {
      await apiClient.patch(`/api/admin/questions/${q.id}/toggle`);
      await load();
    } catch {
      alert('שגיאה בשינוי סטטוס');
    }
  };

  const handleDelete = async (q: Question) => {
    if (!confirm(`למחוק את השאלה?\n"${q.text}"`)) return;
    try {
      const res = await apiClient.delete(`/api/admin/questions/${q.id}`);
      if (res.data.deactivated) alert(res.data.message);
      await load();
    } catch {
      alert('שגיאה במחיקה');
    }
  };

  const setOpt = (i: number, val: string) => {
    const opts = [...form.choiceOptions];
    opts[i] = val;
    setForm(f => ({ ...f, choiceOptions: opts }));
  };

  const addOpt = () => setForm(f => ({ ...f, choiceOptions: [...f.choiceOptions, ''] }));
  const removeOpt = (i: number) => setForm(f => ({ ...f, choiceOptions: f.choiceOptions.filter((_, idx) => idx !== i) }));

  const active = questions.filter(q => q.isActive);
  const inactive = questions.filter(q => !q.isActive);

  if (!isAdmin) return null;

  return (
    <AppShell maxWidth="2xl">
      {/* כותרת */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">ניהול שאלות שאלון</h1>
          <div className="flex gap-4 mt-1 text-sm text-neutral-500">
            <span>סה"כ: <b className="text-neutral-700">{questions.length}</b></span>
            <span>פעילות: <b className="text-green-600">{active.length}</b></span>
            <span>מושבתות: <b className="text-neutral-400">{inactive.length}</b></span>
          </div>
        </div>
        <Button onClick={startAdd} disabled={editingId === 'new'}>+ הוסף שאלה</Button>
      </div>

      {error && <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}

      {/* טופס הוספה */}
      {editingId === 'new' && (
        <QuestionForm
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={cancelEdit}
          saving={saving}
          error={formError}
          isNew
          setOpt={setOpt}
          addOpt={addOpt}
          removeOpt={removeOpt}
        />
      )}

      {/* רשימת שאלות */}
      {loading ? (
        <div className="text-center py-12 text-neutral-400">טוען...</div>
      ) : (
        <div className="flex flex-col gap-2">
          {questions.map(q => (
            <div key={q.id}>
              <div
                className={`bg-white rounded-xl border px-4 py-3 flex items-start gap-3 transition-all ${
                  !q.isActive ? 'opacity-50 border-dashed border-neutral-200' : 'border-neutral-200'
                } ${editingId === q.id ? 'border-brand-300 shadow-sm' : ''}`}
              >
                {/* מספר סדר */}
                <span className="w-6 text-center text-sm font-bold text-neutral-400 mt-0.5 shrink-0">{q.order}</span>

                {/* תוכן */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${q.isActive ? 'text-neutral-900' : 'text-neutral-400 line-through'}`}>
                    {q.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <TypeBadge type={q.type} />
                    <span className="text-xs text-neutral-400">{q.category}</span>
                    {q.options && (
                      <span className="text-xs text-neutral-300">
                        {q.type === 'SCALE'
                          ? `${(q.options as string[])[0]} ↔ ${(q.options as string[])[4]}`
                          : (q.options as string[]).join(' · ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* פעולות */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(q)}
                    disabled={editingId !== undefined && editingId !== null}
                    title="עריכה"
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-brand-500 hover:bg-brand-50 transition-colors disabled:opacity-30"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleToggle(q)}
                    title={q.isActive ? 'השבת' : 'הפעל'}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-yellow-500 hover:bg-yellow-50 transition-colors"
                  >
                    {q.isActive ? '🔕' : '🔔'}
                  </button>
                  <button
                    onClick={() => handleDelete(q)}
                    title="מחק"
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* טופס עריכה — מוצג מתחת לשאלה */}
              {editingId === q.id && (
                <QuestionForm
                  form={form}
                  setForm={setForm}
                  onSave={handleSave}
                  onCancel={cancelEdit}
                  saving={saving}
                  error={formError}
                  isNew={false}
                  setOpt={setOpt}
                  addOpt={addOpt}
                  removeOpt={removeOpt}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
};

/* ───────── TypeBadge ───────── */
const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const colors: Record<string, string> = {
    SINGLE_CHOICE: 'bg-blue-50 text-blue-600',
    MULTI_CHOICE: 'bg-purple-50 text-purple-600',
    SCALE: 'bg-orange-50 text-orange-600',
    TEXT: 'bg-neutral-100 text-neutral-500',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[type] ?? 'bg-neutral-100 text-neutral-500'}`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
};

/* ───────── QuestionForm ───────── */
interface FormProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
  isNew: boolean;
  setOpt: (i: number, val: string) => void;
  addOpt: () => void;
  removeOpt: (i: number) => void;
}

const QuestionForm: React.FC<FormProps> = ({
  form, setForm, onSave, onCancel, saving, error, isNew,
  setOpt, addOpt, removeOpt,
}) => {
  const f = form;
  const set = (k: keyof FormState, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="bg-neutral-50 border border-brand-200 rounded-xl p-4 mt-1 mb-2">
      <h3 className="text-sm font-semibold text-brand-700 mb-3">{isNew ? 'הוספת שאלה חדשה' : 'עריכת שאלה'}</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* טקסט */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-neutral-600 mb-1">טקסט השאלה *</label>
          <textarea
            value={f.text}
            onChange={e => set('text', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>

        {/* קטגוריה */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">קטגוריה *</label>
          <input
            list="categories-list"
            value={f.category}
            onChange={e => set('category', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <datalist id="categories-list">
            {CATEGORIES.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        {/* סוג */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">סוג שאלה *</label>
          <select
            value={f.type}
            onChange={e => set('type', e.target.value as QuestionType)}
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="SINGLE_CHOICE">בחירה יחידה</option>
            <option value="MULTI_CHOICE">בחירה מרובה</option>
            <option value="SCALE">סקאלה 1–5</option>
            <option value="TEXT">טקסט חופשי</option>
          </select>
        </div>

        {/* מספר סדר */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">מספר סדר</label>
          <input
            type="number"
            value={f.order}
            onChange={e => set('order', Number(e.target.value))}
            min={1}
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* פעיל */}
        <div className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            id="isActive"
            checked={f.isActive}
            onChange={e => set('isActive', e.target.checked)}
            className="w-4 h-4 rounded accent-brand-500"
          />
          <label htmlFor="isActive" className="text-sm text-neutral-700">שאלה פעילה</label>
        </div>
      </div>

      {/* אפשרויות — בחירה יחידה / מרובה */}
      {(f.type === 'SINGLE_CHOICE' || f.type === 'MULTI_CHOICE') && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-neutral-600 mb-1">אפשרויות בחירה</label>
          <div className="flex flex-col gap-2">
            {f.choiceOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-neutral-400 w-5 text-center">{i + 1}.</span>
                <input
                  value={opt}
                  onChange={e => setOpt(i, e.target.value)}
                  placeholder={`אפשרות ${i + 1}`}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {f.choiceOptions.length > 2 && (
                  <button
                    onClick={() => removeOpt(i)}
                    className="text-neutral-300 hover:text-red-400 transition-colors text-lg leading-none"
                  >×</button>
                )}
              </div>
            ))}
            <button
              onClick={addOpt}
              className="text-xs text-brand-500 hover:text-brand-700 self-start mt-1"
            >
              + הוסף אפשרות
            </button>
          </div>
        </div>
      )}

      {/* אפשרויות — סקאלה */}
      {f.type === 'SCALE' && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">תווית נמוכה (ערך 1)</label>
            <input
              value={f.scaleLow}
              onChange={e => setForm(prev => ({ ...prev, scaleLow: e.target.value }))}
              placeholder="לדוגמה: תכנון מלא"
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">תווית גבוהה (ערך 5)</label>
            <input
              value={f.scaleHigh}
              onChange={e => setForm(prev => ({ ...prev, scaleHigh: e.target.value }))}
              placeholder="לדוגמה: זורם לגמרי"
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      )}

      {/* שגיאה */}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {/* כפתורים */}
      <div className="flex gap-2 mt-4 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>ביטול</Button>
        <Button size="sm" onClick={onSave} loading={saving}>
          {isNew ? 'הוסף שאלה' : 'שמור שינויים'}
        </Button>
      </div>
    </div>
  );
};
