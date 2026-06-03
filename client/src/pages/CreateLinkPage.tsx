import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import apiClient from '../api/client';
import type { TripLinkType, Decision } from '../types';

function detectType(url: string): TripLinkType {
  const u = url.toLowerCase();
  if (/airbnb|booking\.com|hotels\.com|expedia|hotel|hostel/.test(u)) return 'HOTEL';
  if (/google\.com\/maps|maps\.apple|waze\.com|maps\.google/.test(u)) return 'MAP';
  if (/skyscanner|kayak|ryanair|easyjet|elal|flightaware|google\.com\/flights|airline/.test(u)) return 'FLIGHT';
  if (/viator|tripadvisor|getyourguide|klook/.test(u)) return 'ACTIVITY';
  if (/rentalcars|avis\.com|hertz\.com|enterprise\.com|sixt\.com|budget\.com/.test(u)) return 'CAR';
  if (/opentable|zomato|yelp\.com|restaurant|cafe/.test(u)) return 'RESTAURANT';
  if (/transferwise|wise\.com|paypal|revolut|splitwise/.test(u)) return 'PAYMENT';
  return 'OTHER';
}

const TYPE_OPTIONS: { type: TripLinkType; icon: string; label: string }[] = [
  { type: 'FLIGHT', icon: '✈️', label: 'טיסה' },
  { type: 'HOTEL', icon: '🏨', label: 'לינה' },
  { type: 'CAR', icon: '🚗', label: 'רכב' },
  { type: 'ACTIVITY', icon: '🎯', label: 'אטרקציה' },
  { type: 'RESTAURANT', icon: '🍽️', label: 'מסעדה' },
  { type: 'BAR', icon: '🍻', label: 'בר' },
  { type: 'MAP', icon: '🗺️', label: 'מפה' },
  { type: 'INSURANCE', icon: '🛡️', label: 'ביטוח' },
  { type: 'DOCUMENT', icon: '📄', label: 'מסמך' },
  { type: 'PAYMENT', icon: '💳', label: 'תשלום' },
  { type: 'OTHER', icon: '📌', label: 'אחר' },
];

export const CreateLinkPage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedDecisionId = searchParams.get('decisionId');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<TripLinkType>('OTHER');
  const [notes, setNotes] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [decisionId, setDecisionId] = useState(preselectedDecisionId ?? '');
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tripId) return;
    apiClient.get<Decision[]>(`/api/decisions/${tripId}`)
      .then(({ data }) => setDecisions(data))
      .catch(() => {});
  }, [tripId]);

  const handleUrlBlur = () => {
    if (url.trim()) setType(detectType(url));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await apiClient.post<{ fileUrl: string; fileName: string }>(
        `/api/links/${tripId}/upload`, form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setFileUrl(data.fileUrl);
      setFileName(data.fileName);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'שגיאה בהעלאת הקובץ');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFileUrl('');
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('כותרת שדה חובה'); return; }
    setSaving(true);
    setError('');
    try {
      await apiClient.post(`/api/links/${tripId}`, {
        title: title.trim(),
        url: url.trim() || null,
        type,
        notes: notes.trim() || null,
        decisionId: decisionId || null,
        isPrivate,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
      });
      navigate(`/trip/${tripId}/links`);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'שגיאה ביצירת הקישור');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-36">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-neutral-500 text-sm mb-6 active:opacity-70">
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
          חזרה
        </button>

        <h1 className="text-2xl font-bold text-neutral-900 mb-6">קישור חדש</h1>

        <div className="flex flex-col gap-5">
          {/* URL */}
          <div>
            <label className="text-sm font-bold text-neutral-700 mb-1.5 block">קישור (URL)</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="https://..."
              dir="ltr"
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
            />
            <p className="text-xs text-neutral-400 mt-1">הדבק קישור — הסוג יזוהה אוטומטית</p>
          </div>

          {/* File upload */}
          <div>
            <label className="text-sm font-bold text-neutral-700 mb-1.5 block">או העלה קובץ / תמונה</label>
            {fileUrl ? (
              <div className="flex items-center gap-3 border border-green-200 bg-green-50 rounded-xl px-4 py-3">
                <span className="text-green-600 text-sm flex-1 truncate">📎 {fileName}</span>
                <button onClick={removeFile} className="text-red-400 text-xs font-medium flex-shrink-0">הסר</button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-neutral-300 rounded-xl px-4 py-4 text-sm text-neutral-500 flex items-center justify-center gap-2 active:bg-neutral-50 disabled:opacity-50"
              >
                {uploading ? (
                  'מעלה...'
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                    </svg>
                    בחר קובץ (תמונה, PDF, Word)
                  </>
                )}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-bold text-neutral-700 mb-1.5 block">כותרת *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="לדוגמה: טיסה תל אביב → ברצלונה"
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-sm font-bold text-neutral-700 mb-2 block">סוג</label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => setType(opt.type)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                    type === opt.type
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-neutral-200 bg-white text-neutral-600'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-bold text-neutral-700 mb-1.5 block">הערות (אופציונלי)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="מידע נוסף שכדאי לדעת..."
              rows={3}
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 resize-none"
            />
          </div>

          {/* Privacy toggle */}
          <div className="flex items-center justify-between py-3 border-t border-neutral-100">
            <div>
              <p className="text-sm font-bold text-neutral-800">{isPrivate ? '🔒 פרטי' : '🌐 ציבורי'}</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isPrivate ? 'רק אתה רואה את הקישור הזה' : 'כל חברי הטיול רואים'}
              </p>
            </div>
            <button
              onClick={() => setIsPrivate(p => !p)}
              className={`relative w-12 h-6 rounded-full transition-colors ${isPrivate ? 'bg-brand-500' : 'bg-neutral-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isPrivate ? 'translate-x-0.5' : 'translate-x-6'}`} />
            </button>
          </div>

          {/* Decision link */}
          {decisions.length > 0 && (
            <div>
              <label className="text-sm font-bold text-neutral-700 mb-1.5 block">קשור להחלטה (אופציונלי)</label>
              <select
                value={decisionId}
                onChange={e => setDecisionId(e.target.value)}
                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 bg-white"
              >
                <option value="">ללא קישור להחלטה</option>
                {decisions.map(d => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
        </div>
      </div>

      <div className="fixed bottom-0 right-0 left-0 bg-white border-t border-neutral-100 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSubmit}
            disabled={saving || uploading || !title.trim()}
            className="w-full bg-brand-500 text-white font-bold py-4 rounded-2xl active:bg-brand-600 disabled:opacity-50 text-base"
          >
            {saving ? 'שומר...' : 'שמור קישור'}
          </button>
        </div>
      </div>
    </AppShell>
  );
};
