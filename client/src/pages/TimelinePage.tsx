import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import { useTripStore } from '../store/tripStore';
import { useActiveTripStore } from '../store/activeTripStore';
import { useAuthStore } from '../store/authStore';
import apiClient from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type TimelineFilter =
  | 'all'
  | 'expenses'
  | 'places'
  | 'photos'
  | 'decisions'
  | 'documents'
  | 'members'
  | 'memory'
  | 'ai';

interface TimelineEvent {
  id: string;
  tripId: string;
  type: string;
  category: string;
  title: string;
  description?: string | null;
  emoji: string;
  isPrivate: boolean;
  aiGenerated?: boolean;
  createdByUserId?: string | null;
  createdBy?: { id: string; name: string; avatarUrl?: string | null } | null;
  refType?: string | null;
  refId?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
}

const FILTERS: { id: TimelineFilter; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'expenses', label: 'הוצאות' },
  { id: 'places', label: 'מקומות' },
  { id: 'photos', label: 'תמונות' },
  { id: 'decisions', label: 'החלטות' },
  { id: 'documents', label: 'מסמכים' },
  { id: 'members', label: 'חברים' },
  { id: 'memory', label: 'זיכרונות' },
  { id: 'ai', label: 'AI' },
];

const MEMORY_EMOJIS = ['✨', '🎉', '😂', '❤️', '🌧️', '🍺', '🏔️', '📸', '🥳', '😮'];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatDayHeader(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yestKey = yest.toISOString().slice(0, 10);

  if (isoDate === todayKey) return 'היום';
  if (isoDate === yestKey) return 'אתמול';
  return d.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const TimelinePage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const { currentTrip, loadTrip } = useTripStore();
  const { setActiveTrip } = useActiveTripStore();
  const { user } = useAuthStore();

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Add memory sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [memTitle, setMemTitle] = useState('');
  const [memDesc, setMemDesc] = useState('');
  const [memEmoji, setMemEmoji] = useState('✨');
  const [memDate, setMemDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [aiAllowed, setAiAllowed] = useState(false);
  const [aiRecapping, setAiRecapping] = useState(false);
  const [aiError, setAiError] = useState('');

  const myMember = currentTrip?.members.find((m) => m.userId === user?.id);
  const isAdmin = myMember?.role === 'ADMIN';

  useEffect(() => {
    if (tripId) loadTrip(tripId);
  }, [tripId]);

  useEffect(() => {
    if (tripId && currentTrip) setActiveTrip(tripId, currentTrip.name);
  }, [tripId, currentTrip?.name]);

  const load = useCallback(
    async (opts?: { append?: boolean; before?: string }) => {
      if (!tripId) return;
      if (opts?.append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('filter', filter);
        params.set('limit', '40');
        if (opts?.before) params.set('before', opts.before);

        const { data } = await apiClient.get<{
          events: TimelineEvent[];
          ai?: { allowed?: boolean };
        }>(`/api/timeline/${tripId}?${params.toString()}`);
        const list = data.events ?? [];
        setHasMore(list.length >= 40);
        setEvents((prev) => (opts?.append ? [...prev, ...list] : list));
        if (data.ai) setAiAllowed(Boolean(data.ai.allowed));
      } catch {
        if (!opts?.append) setEvents([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tripId, filter],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when app returns to focus
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of events) {
      const key = dayKey(e.occurredAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [events]);

  const handleAddMemory = async () => {
    if (!tripId || !memTitle.trim()) {
      setError('כותרת שדה חובה');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const occurredAt = new Date(`${memDate}T${new Date().toTimeString().slice(0, 8)}`);
      const { data } = await apiClient.post<{ event: TimelineEvent }>(`/api/timeline/${tripId}`, {
        title: memTitle.trim(),
        description: memDesc.trim() || null,
        emoji: memEmoji,
        occurredAt: occurredAt.toISOString(),
      });
      // Prepend if matches current filter
      if (filter === 'all' || filter === 'memory') {
        setEvents((prev) => [data.event, ...prev]);
      }
      setSheetOpen(false);
      setMemTitle('');
      setMemDesc('');
      setMemEmoji('✨');
      setMemDate(new Date().toISOString().slice(0, 10));
    } catch {
      setError('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: TimelineEvent) => {
    const canDelete =
      event.type === 'MEMORY'
        ? event.createdByUserId === user?.id || isAdmin
        : isAdmin;
    if (!canDelete) return;
    if (!confirm('למחוק אירוע זה מציר הזמן?')) return;

    setDeletingId(event.id);
    try {
      await apiClient.delete(`/api/timeline/${event.id}`);
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
    } catch {
      /* silent */
    } finally {
      setDeletingId(null);
    }
  };

  const loadMore = () => {
    if (!events.length || loadingMore || !hasMore) return;
    const last = events[events.length - 1];
    load({ append: true, before: last.occurredAt });
  };

  const runAiRecap = async () => {
    if (!tripId || aiRecapping) return;
    setAiRecapping(true);
    setAiError('');
    try {
      const { data } = await apiClient.post(`/api/timeline/${tripId}/ai-recap`, {
        replace: true,
      });
      // Reload full timeline so day cards sit under correct day groups
      await load();
      setFilter('all');
      if (data.days) {
        // brief success via clearing error area
        setAiError('');
      }
    } catch (e: any) {
      setAiError(e?.response?.data?.error || 'שגיאה ביצירת סיכום AI לפי ימים');
    } finally {
      setAiRecapping(false);
    }
  };

  return (
    <AppShell showBottomNav>
      <div className="mb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">📖 ציר זמן</h1>
            <p className="text-sm text-neutral-500 mt-1">סיפור הטיול — אוטומטי + זיכרונות + AI</p>
          </div>
          <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
            <button
              onClick={() => setSheetOpen(true)}
              className="text-sm font-bold px-3 py-2 rounded-xl bg-brand-500 text-white active:bg-brand-600"
            >
              + זיכרון
            </button>
            {aiAllowed && (
              <button
                onClick={runAiRecap}
                disabled={aiRecapping}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 disabled:opacity-50"
              >
                {aiRecapping ? 'כותב ימים...' : '✨ סיכום AI לפי ימים'}
              </button>
            )}
          </div>
        </div>
        {aiError && <p className="text-xs text-red-500 mt-2">{aiError}</p>}
        {aiAllowed && (
          <p className="text-[11px] text-neutral-400 mt-2">
            יוצר כרטיס סיפור AI לכל יום שיש בו אירועים (מחליף סיכומי AI קודמים)
          </p>
        )}
        {!aiAllowed && (
          <p className="text-[11px] text-neutral-400 mt-2">
            סיכום AI כבוי — הפעילו ב״פרופיל → עוזר AI״ ובטיול (מנהל)
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                active
                  ? 'bg-brand-500 text-white'
                  : 'bg-neutral-100 text-neutral-600 active:bg-neutral-200'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12 text-neutral-400 text-sm">טוען...</div>
      ) : events.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-5xl mb-3">📭</div>
          <h2 className="font-bold text-neutral-800 mb-2">עדיין אין אירועים</h2>
          <p className="text-sm text-neutral-500 leading-relaxed mb-4">
            אירועים יופיעו אוטומטית כשמצטרפים חברים, סוגרים החלטות, מוסיפים מקומות, הוצאות ומסמכים.
            אפשר גם להוסיף זיכרון ידני.
          </p>
          <button
            onClick={() => setSheetOpen(true)}
            className="text-sm font-bold text-brand-600 bg-brand-50 px-4 py-2 rounded-xl"
          >
            + הוסף זיכרון ראשון
          </button>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([day, dayEvents]) => (
            <section key={day}>
              <h2 className="text-xs font-bold text-neutral-400 mb-2 sticky top-14 bg-neutral-50/95 py-1 z-10">
                {formatDayHeader(day)}
              </h2>
              <div className="relative pr-4 border-r-2 border-neutral-200 mr-3 flex flex-col gap-3">
                {dayEvents.map((ev) => {
                  const canDelete =
                    ev.type === 'MEMORY'
                      ? ev.createdByUserId === user?.id || isAdmin
                      : isAdmin;
                  return (
                    <div key={ev.id} className="relative">
                      {/* Dot on timeline */}
                      <span className="absolute -right-[1.4rem] top-4 w-3 h-3 rounded-full bg-white border-2 border-brand-400" />

                      <Card className="p-3.5">
                        <div className="flex items-start gap-2.5">
                          <span className="text-xl leading-none mt-0.5 flex-shrink-0">{ev.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-neutral-900 leading-snug">
                                {ev.title}
                              </p>
                              <span className="text-[11px] text-neutral-400 tabular-nums flex-shrink-0">
                                {formatTime(ev.occurredAt)}
                              </span>
                            </div>
                            {ev.description && (
                              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                                {ev.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {ev.createdBy && (
                                <span className="text-[11px] text-neutral-400">
                                  {ev.createdBy.name}
                                </span>
                              )}
                              {ev.isPrivate && (
                                <span className="text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">
                                  🔒 פרטי
                                </span>
                              )}
                              {ev.type === 'MEMORY' && (
                                <span className="text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full font-medium">
                                  זיכרון
                                </span>
                              )}
                              {(ev.aiGenerated || ev.category === 'ai' || ev.type === 'AI_RECAP') && (
                                <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full font-medium">
                                  AI
                                </span>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => handleDelete(ev)}
                                  disabled={deletingId === ev.id}
                                  className="text-[11px] text-red-400 mr-auto disabled:opacity-40"
                                >
                                  {deletingId === ev.id ? '...' : 'מחק'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-sm font-medium text-brand-600 py-3 disabled:opacity-50"
            >
              {loadingMore ? 'טוען...' : 'טען עוד'}
            </button>
          )}
        </div>
      )}

      {/* Add memory sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setSheetOpen(false)} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl p-5 pb-10 max-h-[90dvh] overflow-y-auto">
            <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold text-neutral-900 mb-4">✨ זיכרון חדש</h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-neutral-600 mb-1.5 block">אימוג׳י</label>
                <div className="flex flex-wrap gap-1.5">
                  {MEMORY_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setMemEmoji(e)}
                      className={`w-10 h-10 rounded-xl text-lg border transition-colors ${
                        memEmoji === e
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-neutral-200 bg-white'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-600 mb-1.5 block">מה קרה?</label>
                <input
                  type="text"
                  value={memTitle}
                  onChange={(e) => setMemTitle(e.target.value)}
                  placeholder='למשל: "שלג ראשון!"'
                  className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                  maxLength={120}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-600 mb-1.5 block">פרטים (אופציונלי)</label>
                <textarea
                  value={memDesc}
                  onChange={(e) => setMemDesc(e.target.value)}
                  placeholder="עוד קצת על הרגע..."
                  rows={3}
                  className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 resize-none"
                  maxLength={500}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-600 mb-1.5 block">תאריך</label>
                <input
                  type="date"
                  value={memDate}
                  onChange={(e) => setMemDate(e.target.value)}
                  className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              {error && <p className="text-sm text-red-500 text-center">{error}</p>}

              <button
                onClick={handleAddMemory}
                disabled={saving || !memTitle.trim()}
                className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-2xl active:bg-brand-600 disabled:opacity-50"
              >
                {saving ? 'שומר...' : 'הוסף לציר הזמן'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
