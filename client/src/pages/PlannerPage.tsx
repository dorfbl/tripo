import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/tripStore';
import { AppShell } from '../components/layout/AppShell';
import { PlanSubNav } from '../components/layout/PlanSubNav';
import apiClient from '../api/client';

// ─── Constants ────────────────────────────────────────────────────────────────

const START_HOUR = 0;
const END_HOUR   = 24;
const PX_PER_HR  = 64;   // pixels per hour
const PX_PER_MIN = PX_PER_HR / 60;
const START_MIN  = START_HOUR * 60;
const END_MIN    = END_HOUR   * 60;
const GRID_H     = (END_HOUR - START_HOUR) * PX_PER_HR; // 1024
const HOURS      = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const DAY_HDR_H  = 48; // sticky day header height
const TIME_COL_W = 52; // time labels column width
const SIDEBAR_MIN_W = 220;
const SIDEBAR_MAX_W = 640;
const SIDEBAR_DEFAULT_W = 288;
const SIDEBAR_WIDTH_STORAGE_KEY = 'plannerSidebarWidth';

const snap15 = (m: number) => Math.round(m / 15) * 15;
const minToY  = (m: number) => (m - START_MIN) * PX_PER_MIN;
const yToMin  = (y: number) => snap15(START_MIN + y / PX_PER_MIN);
const clamp   = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const fmtMin = (m: number) => {
  const wrapped = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60), mm = wrapped % 60;
  return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
};
const fmtDur = (mins: number) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h && m ? `${h}ש' ${m}ד'` : h ? `${h}ש'` : `${m}ד'`;
};
const fmtDate = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });

// ─── Categories & Colors (generic — not trip-specific) ───────────────────────

const CATS = [
  { id: 'nature',     label: '🌲 טבע',      color: 'green'  },
  { id: 'culture',    label: '🏛️ תרבות',    color: 'blue'   },
  { id: 'activity',   label: '🎯 פעילות',   color: 'purple' },
  { id: 'restaurant', label: '🍽️ מסעדה',    color: 'orange' },
  { id: 'hotel',      label: '🏨 לינה',     color: 'blue'   },
  { id: 'shopping',   label: '🛍️ קניות',    color: 'orange' },
  { id: 'travel',     label: '🚐 נסיעה',    color: 'yellow' },
  { id: 'special',    label: '⭐ מיוחד',    color: 'red'    },
  { id: 'other',      label: '📌 כללי',     color: 'gray'   },
];

const COLORS: Record<string, { pill: string; event: string; border: string; text: string }> = {
  green:  { pill:'bg-green-100 text-green-800',  event:'bg-green-200 border-green-400',  border:'border-green-400', text:'text-green-900' },
  blue:   { pill:'bg-blue-100 text-blue-800',    event:'bg-blue-200 border-blue-400',    border:'border-blue-400',  text:'text-blue-900'  },
  yellow: { pill:'bg-yellow-100 text-yellow-800',event:'bg-yellow-200 border-yellow-400',border:'border-yellow-400',text:'text-yellow-900'},
  orange: { pill:'bg-orange-100 text-orange-800',event:'bg-orange-200 border-orange-400',border:'border-orange-400',text:'text-orange-900'},
  red:    { pill:'bg-red-100 text-red-800',      event:'bg-red-200 border-red-400',      border:'border-red-400',   text:'text-red-900'   },
  purple: { pill:'bg-purple-100 text-purple-800',event:'bg-purple-200 border-purple-400',border:'border-purple-400',text:'text-purple-900'},
  gray:   { pill:'bg-neutral-100 text-neutral-600',event:'bg-neutral-200 border-neutral-300',border:'border-neutral-300',text:'text-neutral-700'},
};

const catLabel = (id: string) => CATS.find(c => c.id === id)?.label ?? id;
const catColor = (cat: string) => CATS.find(c => c.id === cat)?.color ?? 'gray';
const col = (color: string) => COLORS[color] ?? COLORS.gray;
const mapPlaceCategory = (cat?: string) => {
  switch (cat) {
    case 'nature':
    case 'forest': return 'nature';
    case 'food': return 'restaurant';
    case 'travel': return 'transport';
    case 'culture':
    case 'munich': return 'culture';
    case 'activity':
    case 'special': return 'activity';
    default: return 'other';
  }
};

// ─── Modern mono icons (soft stroke, Lucide-like) ────────────────────────────

type IconName =
  | 'link'
  | 'map'
  | 'pin'
  | 'edit'
  | 'trash'
  | 'undo'
  | 'paperclip'
  | 'clock'
  | 'external'
  | 'image'
  | 'file'
  | 'alert'
  | 'close';

/** Smooth single-color outline icons */
const Icon: React.FC<{ name: IconName; className?: string; size?: number }> = ({
  name,
  className = '',
  size = 15,
}) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: `flex-shrink-0 ${className}`,
    'aria-hidden': true as const,
  };

  // Paths tuned for a softer, more modern silhouette
  switch (name) {
    case 'link':
      return (
        <svg {...common}>
          <path d="M9.5 14.5a4.2 4.2 0 006 0l2.3-2.3a4.2 4.2 0 10-6-6L10.5 7.5" />
          <path d="M14.5 9.5a4.2 4.2 0 00-6 0L6.2 11.8a4.2 4.2 0 106 6l1.3-1.3" />
        </svg>
      );
    case 'map':
      return (
        <svg {...common}>
          <path d="M9 4.5l6 2.2 5.5-2.2v14.5l-5.5 2.2L9 19 3.5 21.2V6.7L9 4.5z" />
          <path d="M9 4.5v14.5M15 6.7v14.5" />
        </svg>
      );
    case 'pin':
      return (
        <svg {...common}>
          <path d="M12 21s6.5-5.4 6.5-10.2A6.5 6.5 0 0012 4.3a6.5 6.5 0 00-6.5 6.5C5.5 15.6 12 21 12 21z" />
          <circle cx="12" cy="10.8" r="2.1" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...common}>
          <path d="M4 20h4l11-11a2.1 2.1 0 00-3-3L5 17v3z" />
          <path d="M13.5 6.5l3 3" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common}>
          <path d="M4.5 7h15" />
          <path d="M9.5 7V5.2A1.2 1.2 0 0110.7 4h2.6a1.2 1.2 0 011.2 1.2V7" />
          <path d="M18.2 7l-.7 11.2a2 2 0 01-2 1.8H8.5a2 2 0 01-2-1.8L5.8 7" />
          <path d="M10 11v5.5M14 11v5.5" />
        </svg>
      );
    case 'undo':
      return (
        <svg {...common}>
          <path d="M8 13l-3.5-3.5L8 6" />
          <path d="M4.5 9.5H14a5 5 0 010 10h-3.5" />
        </svg>
      );
    case 'paperclip':
      return (
        <svg {...common}>
          <path d="M8.5 12.5l6.4-6.4a2.6 2.6 0 113.7 3.7l-8.1 8.1a4.2 4.2 0 11-5.9-5.9l7.6-7.6" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.25" />
          <path d="M12 7.8V12l2.8 1.8" />
        </svg>
      );
    case 'external':
      return (
        <svg {...common}>
          <path d="M14 5h5v5" />
          <path d="M10 14L19 5" />
          <path d="M18 13.5V18a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 014 18V7A1.5 1.5 0 015.5 5.5H10" />
        </svg>
      );
    case 'image':
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
          <circle cx="9" cy="10.2" r="1.4" />
          <path d="M3.8 16.2l4.6-3.6 3.2 2.5 3.4-4.2 5 5.1" />
        </svg>
      );
    case 'file':
      return (
        <svg {...common}>
          <path d="M13.5 3.5H8A2.5 2.5 0 005.5 6v12A2.5 2.5 0 008 20.5h8A2.5 2.5 0 0018.5 18V8.5L13.5 3.5z" />
          <path d="M13.5 3.5V8.5h5" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...common}>
          <path d="M12 9.2v4.2" />
          <path d="M12 16.6h.01" />
          <path d="M10.55 4.9L3.1 17.6a1.8 1.8 0 001.55 2.7h14.7a1.8 1.8 0 001.55-2.7L13.45 4.9a1.8 1.8 0 00-2.9 0z" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common}>
          <path d="M7 7l10 10M17 7L7 17" />
        </svg>
      );
    default:
      return null;
  }
};

/** Soft pill action buttons — modern / smooth */
const iconBtn =
  'inline-flex items-center justify-center w-7 h-7 rounded-full text-neutral-500 ' +
  'bg-white/55 backdrop-blur-[2px] shadow-sm ring-1 ring-black/[0.04] ' +
  'hover:text-brand-600 hover:bg-white hover:shadow hover:ring-brand-200/60 ' +
  'active:scale-95 transition-all duration-200 ease-out flex-shrink-0';
const iconBtnSm =
  'inline-flex items-center justify-center w-6 h-6 rounded-full text-neutral-500 ' +
  'bg-white/50 ring-1 ring-black/[0.04] ' +
  'hover:text-brand-600 hover:bg-white hover:shadow-sm ' +
  'active:scale-95 transition-all duration-200 ease-out flex-shrink-0';
const iconBtnGhost =
  'inline-flex items-center justify-center w-7 h-7 rounded-full text-neutral-400 ' +
  'hover:text-brand-600 hover:bg-brand-50 ' +
  'active:scale-95 transition-all duration-200 ease-out flex-shrink-0';
const iconBtnDanger =
  'inline-flex items-center justify-center w-7 h-7 rounded-full text-neutral-500 ' +
  'bg-white/55 backdrop-blur-[2px] shadow-sm ring-1 ring-black/[0.04] ' +
  'hover:text-red-600 hover:bg-red-50 hover:ring-red-100 ' +
  'active:scale-95 transition-all duration-200 ease-out flex-shrink-0';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityFile {
  id: string; activityId: string; filename: string; originalName: string; mimeType: string; size: number;
}
interface EventFile {
  id: string; eventId: string; filename: string; originalName: string; mimeType: string; size: number;
}
interface Activity {
  id: string;
  name: string;
  nameOriginal?: string | null;
  emoji: string;
  location?: string;
  description?: string;
  durationMins: number;
  estimatedDuration?: string | null;
  cost?: string;
  category: string;
  mapsUrl?: string;
  url?: string;
  color: string;
  placeId?: string | null;
  openingHours?: any;
  rating?: number | null;
  ratingCount?: number | null;
  files: ActivityFile[];
}

interface ScheduleWarning {
  severity: 'warn' | 'critical';
  code: string;
  message: string;
  dayLabel?: string;
  hoursSummary?: string;
  source: 'google' | 'heuristic';
}

interface CalEvent {
  id: string; activityId?: string; title: string; date: string;
  startMinute: number; durationMins: number; color: string; notes?: string;
  allDay?: boolean; url?: string; mapsUrl?: string; cost?: string; files?: EventFile[];
  scheduleWarnings?: ScheduleWarning[];
  scheduleSeverity?: 'warn' | 'critical' | null;
}

type ModalState =
  | { type: 'none' }
  | { type: 'addActivity'; data?: Partial<Activity> }
  | { type: 'editActivity'; activity: Activity }
  | { type: 'addEvent'; date: string; startMinute: number; activityId?: string; title?: string; color?: string; durationMins?: number; url?: string; mapsUrl?: string; cost?: string; category?: string; location?: string }
  | { type: 'editEvent'; event: CalEvent };

// ─── Main Page ────────────────────────────────────────────────────────────────

export const PlannerPage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTrip, loadTrip } = useTripStore();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [events, setEvents]         = useState<CalEvent[]>([]);
  const [modal, setModal]           = useState<ModalState>({ type: 'none' });
  const [filter, setFilter]         = useState('all');
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const rawSavedWidth = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    const saved = rawSavedWidth == null ? Number.NaN : Number(rawSavedWidth);
    return Number.isFinite(saved)
      ? clamp(saved, SIDEBAR_MIN_W, SIDEBAR_MAX_W)
      : SIDEBAR_DEFAULT_W;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [weatherByDate, setWeatherByDate] = useState<Record<string, { emoji: string; tempMax: number; rain: number | null }>>({});
  const [hoursToast, setHoursToast] = useState<{ severity: 'warn' | 'critical'; messages: string[] } | null>(null);
  const [aiDraft, setAiDraft] = useState<{
    summaryHe: string;
    skipped: Array<{ activityId: string; name: string; reason: string }>;
    voteStats?: { activities: number; withVotes: number; totalVoteRows: number };
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiApplying, setAiApplying] = useState(false);
  /** Events before AI preview — restored on Cancel */
  const baselineEventsRef = useRef<CalEvent[] | null>(null);

  type AddToMapState =
    | { status: 'geocoding'; name: string }
    | { status: 'confirm'; name: string; displayName: string; lat: number; lng: number; mapsUrl?: string; category?: string }
    | { status: 'saving' }
    | { status: 'done'; name: string }
    | { status: 'error' }
    | null;
  const [addToMap, setAddToMap] = useState<AddToMapState>(null);

  // Drag state (refs to avoid stale closures in mouse handlers)
  const dragActId    = useRef<string | null>(null);
  const eventsRef    = useRef<CalEvent[]>([]);
  const dragEvtState = useRef<{ eventId: string; type: 'move'|'resize'; startY: number; origMin: number; origDur: number; origDate: string } | null>(null);
  const wasDragging  = useRef(false);
  const dayColRefs   = useRef<Map<string, HTMLDivElement>>(new Map());
  const sidebarWidthRef = useRef(sidebarWidth);
  eventsRef.current  = events;
  sidebarWidthRef.current = sidebarWidth;

  const calRef = useRef<HTMLDivElement>(null);

  // ── Load ──
  useEffect(() => {
    if (!tripId) return;
    if (!currentTrip) loadTrip(tripId);
    apiClient.get(`/api/planner/${tripId}`).then(r => {
      setActivities(r.data.activities);
      setEvents(r.data.events);
    }).finally(() => setLoading(false));
    apiClient.get(`/api/weather/${tripId}`).then(r => {
      const daily = r.data?.weather?.daily ?? [];
      const map: Record<string, { emoji: string; tempMax: number; rain: number | null }> = {};
      for (const d of daily) {
        map[d.date] = {
          emoji: d.emoji,
          tempMax: d.tempMax,
          rain: d.precipitationProbability,
        };
      }
      setWeatherByDate(map);
    }).catch(() => {});
  }, [tripId]);

  // ── Global mouse handlers for drag-move / drag-resize within calendar ──
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragEvtState.current;
      if (!ds) return;
      const dy = e.clientY - ds.startY;
      const dMin = Math.round(dy / PX_PER_MIN);
      let targetDate = ds.origDate;
      if (ds.type === 'move') {
        for (const [date, el] of dayColRefs.current) {
          const r = el.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX < r.right) { targetDate = date; break; }
        }
      }
      setEvents(prev => prev.map(ev => {
        if (ev.id !== ds.eventId) return ev;
        if (ds.type === 'move') {
          const newStart = clamp(snap15(ds.origMin + dMin), START_MIN, END_MIN - 15);
          return { ...ev, startMinute: newStart, date: targetDate };
        } else {
          const newDur = Math.max(15, snap15(ds.origDur + dMin));
          return { ...ev, durationMins: newDur };
        }
      }));
    };
    const onUp = () => {
      const ds = dragEvtState.current;
      if (!ds) return;
      dragEvtState.current = null;
      wasDragging.current = true;
      const ev = eventsRef.current.find(e => e.id === ds.eventId);
      if (ev) {
        apiClient
          .patch(`/api/planner/${tripId}/events/${ev.id}`, {
            date: ev.date,
            startMinute: ev.startMinute,
            durationMins: ev.durationMins,
          })
          .then((r) => {
            const updated = r.data.event as CalEvent;
            setEvents((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
            showHoursToast(updated.scheduleWarnings);
          })
          .catch(console.error);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [tripId]);

  // ── Days from trip dates ──
  const days = React.useMemo(() => {
    if (!currentTrip?.startDate || !currentTrip?.endDate) {
      const today = new Date();
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      });
    }
    const result: string[] = [];
    const d = new Date(currentTrip.startDate);
    const end = new Date(currentTrip.endDate);
    while (d <= end) { result.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
    return result;
  }, [currentTrip?.startDate, currentTrip?.endDate]);

  // ── Actions ──
  const saveActivity = async (data: Partial<Activity> & { name: string }) => {
    if ('id' in data && data.id) {
      const r = await apiClient.put(`/api/planner/${tripId}/activities/${data.id}`, data);
      setActivities(prev => prev.map(a => a.id === data.id ? r.data.activity : a));
    } else {
      const r = await apiClient.post(`/api/planner/${tripId}/activities`, data);
      setActivities(prev => [...prev, r.data.activity]);
    }
    setModal({ type: 'none' });
  };

  const deleteActivity = async (actId: string) => {
    await apiClient.delete(`/api/planner/${tripId}/activities/${actId}`);
    setActivities(prev => prev.filter(a => a.id !== actId));
    setEvents(prev => prev.map(ev => ev.activityId === actId ? { ...ev, activityId: undefined } : ev));
    setModal({ type: 'none' });
  };

  const runAiSchedule = async () => {
    if (!tripId || aiLoading || aiDraft) return;
    if (!currentTrip?.startDate || !currentTrip?.endDate) {
      window.alert('יש להגדיר תאריכי התחלה וסיום לטיול לפני סידור AI');
      return;
    }
    if (activities.length === 0) {
      window.alert('אין פעילויות בבנק — הוסיפו פעילויות והצביעו קודם');
      return;
    }
    setAiLoading(true);
    try {
      const { data } = await apiClient.post(`/api/planner/${tripId}/ai-schedule`);
      const slots = data.slots ?? [];
      if (!slots.length) {
        window.alert(data.error || 'ה-AI לא החזיר לוח זמנים');
        return;
      }
      baselineEventsRef.current = eventsRef.current;
      // Preview: keep existing all-day, replace timed with AI draft
      const keepAllDay = eventsRef.current.filter((e) => e.allDay);
      const draftEvents: CalEvent[] = slots.map((s: any) => ({
        id: s.tempId || `draft-${s.activityId}-${s.date}-${s.startMinute}`,
        activityId: s.activityId,
        title: s.title,
        date: s.date,
        startMinute: s.startMinute ?? 0,
        durationMins: s.durationMins ?? 60,
        color: s.color || 'purple',
        allDay: Boolean(s.allDay),
        notes: s.reason || s.notes || null,
        mapsUrl: s.mapsUrl || null,
        cost: s.cost || null,
        scheduleWarnings: s.scheduleWarnings,
        scheduleSeverity: s.scheduleSeverity,
      }));
      setEvents([...keepAllDay.filter((e) => !draftEvents.some((d) => d.allDay && d.date === e.date)), ...draftEvents]);
      setAiDraft({
        summaryHe: data.summaryHe || '',
        skipped: data.skipped || [],
        voteStats: data.voteStats,
      });
    } catch (e: any) {
      window.alert(e?.response?.data?.error || 'שגיאה ביצירת לוח AI');
    } finally {
      setAiLoading(false);
    }
  };

  const cancelAiSchedule = () => {
    if (baselineEventsRef.current) {
      setEvents(baselineEventsRef.current);
    }
    baselineEventsRef.current = null;
    setAiDraft(null);
  };

  const confirmAiSchedule = async () => {
    if (!tripId || !aiDraft) return;
    const draftSlots = eventsRef.current
      .filter((e) => String(e.id).startsWith('draft-'))
      .map((e) => ({
        activityId: e.activityId!,
        title: e.title,
        date: e.date,
        startMinute: e.startMinute,
        durationMins: e.durationMins,
        allDay: e.allDay,
        color: e.color,
        notes: e.notes,
        mapsUrl: e.mapsUrl,
        cost: e.cost,
      }))
      .filter((s) => s.activityId);

    if (!draftSlots.length) {
      window.alert('אין אירועי טיוטה לאישור');
      return;
    }

    setAiApplying(true);
    try {
      const { data } = await apiClient.post(`/api/planner/${tripId}/ai-schedule/apply`, {
        slots: draftSlots,
        replaceTimed: true,
      });
      setEvents(data.events ?? []);
      if (data.activities) setActivities(data.activities);
      baselineEventsRef.current = null;
      setAiDraft(null);
      window.alert(`✅ הלוח עודכן — ${data.created ?? draftSlots.length} אירועים נשמרו`);
    } catch (e: any) {
      window.alert(e?.response?.data?.error || 'שגיאה באישור הלוח');
    } finally {
      setAiApplying(false);
    }
  };

  const showHoursToast = (warnings?: ScheduleWarning[] | null) => {
    if (!warnings?.length) return;
    const severity = warnings.some((w) => w.severity === 'critical') ? 'critical' : 'warn';
    const sorted = [...warnings].sort((a, b) => {
      const score = (w: ScheduleWarning) =>
        w.severity === 'critical' ? 0 : 1;
      return score(a) - score(b);
    });
    setHoursToast({ severity, messages: sorted.map((w) => w.message) });
    // Unmissable for critical
    if (severity === 'critical') {
      window.setTimeout(() => {
        window.alert(
          '🚫 המקום סגור בזמן ששיבצתם:\n\n' +
            sorted.map((w) => '• ' + w.message).join('\n\n'),
        );
      }, 50);
    }
    window.setTimeout(() => setHoursToast(null), 15000);
  };

  const saveEvent = async (data: Omit<CalEvent, 'id'> & { id?: string } & { category?: string; location?: string }) => {
    try {
      if (data.id) {
        const r = await apiClient.patch(`/api/planner/${tripId}/events/${data.id}`, data);
        setEvents(prev => prev.map(ev => ev.id === data.id ? { ...ev, ...r.data.event } : ev));
        showHoursToast(r.data.scheduleWarnings ?? r.data.event?.scheduleWarnings);
      } else {
        const r = await apiClient.post(`/api/planner/${tripId}/events`, data);
        setEvents(prev => [...prev, r.data.event]);
        showHoursToast(r.data.scheduleWarnings ?? r.data.event?.scheduleWarnings);
      }
    } catch (e: any) {
      window.alert(e?.response?.data?.error || 'שגיאה בשמירת האירוע');
      return;
    }
    setModal({ type: 'none' });
  };

  const deleteEvent = async (eventId: string) => {
    await apiClient.delete(`/api/planner/${tripId}/events/${eventId}`);
    setEvents(prev => prev.filter(ev => ev.id !== eventId));
    setModal({ type: 'none' });
  };

  const deleteEventFull = async (ev: CalEvent) => {
    await apiClient.delete(`/api/planner/${tripId}/events/${ev.id}`);
    setEvents(prev => prev.filter(e => e.id !== ev.id));
    if (ev.activityId) {
      await apiClient.delete(`/api/planner/${tripId}/activities/${ev.activityId}`).catch(() => {});
      setActivities(prev => prev.filter(a => a.id !== ev.activityId));
    }
  };


  // ── Add to Map ──
  const handleAddToMap = async (name: string, location?: string, mapsUrl?: string, category?: string) => {
    setAddToMap({ status: 'geocoding', name });
    try {
      // Build search query: prefer mapsUrl q-param, else name + location
      let q = `${name}${location ? ' ' + location : ''}`;
      if (mapsUrl) {
        try {
          const u = new URL(mapsUrl);
          const qParam = u.searchParams.get('q');
          if (qParam) q = qParam;
        } catch { /* ignore bad url */ }
      }
      const res = await apiClient.get(`/api/geocode/search?q=${encodeURIComponent(q)}`);
      const results = res.data.results ?? [];
      if (!results.length) { setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000); return; }
      const top = results[0];
      // If result has no coords, resolve via details
      if (top.lat == null && top.placeId) {
        const det = await apiClient.get(`/api/geocode/details/${top.placeId}`);
        if (!det.data?.lat) { setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000); return; }
        setAddToMap({ status: 'confirm', name, displayName: det.data.name || name, lat: det.data.lat, lng: det.data.lng, mapsUrl, category: mapPlaceCategory(category) });
      } else if (top.lat != null) {
        setAddToMap({ status: 'confirm', name, displayName: top.name || name, lat: top.lat, lng: top.lng, mapsUrl, category: mapPlaceCategory(category) });
      } else {
        setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000);
      }
    } catch { setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000); }
  };

  const confirmAddToMap = async () => {
    if (!addToMap || addToMap.status !== 'confirm') return;
    const { name, displayName, lat, lng, mapsUrl, category } = addToMap;
    setAddToMap({ status: 'saving' });
    try {
      await apiClient.post(`/api/places/${tripId}`, { name: displayName || name, lat, lng, notes: '', mapsUrl: mapsUrl || undefined, category: category || 'other' });
      setAddToMap({ status: 'done', name: displayName || name });
      setTimeout(() => setAddToMap(null), 2500);
    } catch { setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000); }
  };

  // ── Drop activity onto calendar ──
  const getMinuteFromEvent = useCallback((e: React.DragEvent | React.MouseEvent): number => {
    const cal = calRef.current!;
    const rect = cal.getBoundingClientRect();
    const yInContent = (e.clientY - rect.top) + cal.scrollTop - DAY_HDR_H;
    return clamp(yToMin(Math.max(0, yInContent)), START_MIN, END_MIN - 15);
  }, []);

  const handleCalDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };

  const handleColDrop = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    const actId = dragActId.current;
    if (!actId) return;
    const act = activities.find(a => a.id === actId);
    if (!act) return;
    const startMinute = getMinuteFromEvent(e);
    setModal({
      type: 'addEvent',
      date,
      startMinute,
      activityId: act.id,
      title: act.name,
      color: act.color,
      durationMins: act.durationMins,
      url: act.url,
      mapsUrl: act.mapsUrl,
      cost: act.cost,
      category: act.category,
      location: act.location,
    });
  };

  const handleColClick = (e: React.MouseEvent<HTMLDivElement>, date: string) => {
    if ((e.target as HTMLElement).closest('.cal-event')) return;
    const startMinute = getMinuteFromEvent(e);
    setModal({ type: 'addEvent', date, startMinute });
  };

  // ── Visible activities (exclude already-scheduled ones) ──
  const scheduledActIds = new Set(events.filter(ev => ev.activityId).map(ev => ev.activityId!));
  const searchLower = search.trim().toLowerCase();
  // Only show filter chips for categories that actually exist in this trip's bank
  const filterCats = useMemo(() => {
    const present = new Set(activities.map(a => a.category).filter(Boolean));
    const known = CATS.filter(c => present.has(c.id));
    const extra = [...present]
      .filter(id => !CATS.some(c => c.id === id))
      .map(id => {
        console.warn('Unknown category ID found:', id, '- add it to CATS array');
        return { id, label: id, color: 'gray' as const };
      });
    return [...known, ...extra];
  }, [activities]);
  // Reset filter if selected category disappeared (e.g. bank cleared)
  useEffect(() => {
    if (filter !== 'all' && !filterCats.some(c => c.id === filter)) setFilter('all');
  }, [filter, filterCats]);
  const visibleActs = (filter === 'all' ? activities : activities.filter(a => a.category === filter))
    .filter(a => !scheduledActIds.has(a.id))
    .filter(a => !searchLower || a.name.toLowerCase().includes(searchLower) || a.location?.toLowerCase().includes(searchLower) || a.description?.toLowerCase().includes(searchLower));

  const eventsWithHoursIssues = events.filter(
    (ev) => (ev.scheduleWarnings && ev.scheduleWarnings.length > 0) || ev.scheduleSeverity,
  );
  const criticalHoursCount = eventsWithHoursIssues.filter(
    (ev) => ev.scheduleSeverity === 'critical' || ev.scheduleWarnings?.some((w) => w.severity === 'critical'),
  ).length;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Hours warning toast (desktop + after save) */}
      {hoursToast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[10050] max-w-md w-[min(92vw,28rem)] rounded-2xl shadow-xl border px-4 py-3 ${
            hoursToast.severity === 'critical'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
          dir="rtl"
        >
          <div className="flex items-start gap-2">
            <span className="text-lg flex-shrink-0">{hoursToast.severity === 'critical' ? '🚫' : '⚠️'}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold mb-1">
                {hoursToast.severity === 'critical' ? 'ייתכן שהמקום סגור בזמן הזה' : 'שימו לב לשעות פתיחה'}
              </p>
              <ul className="text-xs space-y-1 leading-relaxed">
                {hoursToast.messages.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setHoursToast(null)}
              className="text-neutral-400 hover:text-neutral-700 text-sm flex-shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Mobile — plan tab + hours issues + desktop hint */}
      <div className="md:hidden">
        <AppShell showBottomNav>
          <PlanSubNav />
          {eventsWithHoursIssues.length > 0 && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-right">
              <p className="text-sm font-bold text-red-800 mb-2">
                🚫 {eventsWithHoursIssues.length} אירועים עם בעיית שעות פתיחה
              </p>
              <ul className="flex flex-col gap-2">
                {eventsWithHoursIssues.slice(0, 6).map((ev) => (
                  <li key={ev.id} className="text-xs text-red-700 bg-white/70 rounded-xl px-3 py-2">
                    <span className="font-semibold">{ev.title}</span>
                    <span className="text-red-500"> · {fmtDate(ev.date)} · {fmtMin(ev.startMinute)}</span>
                    {ev.scheduleWarnings?.[0] && (
                      <p className="mt-0.5 text-red-600/90 leading-relaxed">{ev.scheduleWarnings[0].message}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col items-center justify-center py-12 text-center px-2">
            <div className="text-6xl mb-4">🖥️</div>
            <h2 className="text-xl font-bold text-neutral-800 mb-2">לוח זמנים בדסקטופ</h2>
            <p className="text-neutral-500 text-sm mb-6">
              פתח במחשב כדי לערוך את לוח הזמנים. במובייל אפשר להצביע על פעילויות ולנהל החלטות.
              {eventsWithHoursIssues.length > 0 && ' התראות שעות פתיחה מוצגות למעלה.'}
            </p>
            <button
              onClick={() => navigate(`/trip/${tripId}/plan/activities`)}
              className="bg-brand-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold mb-3"
            >
              🗳️ להצבעה על פעילויות
            </button>
            <button
              onClick={() => navigate(`/trip/${tripId}/plan/decisions`)}
              className="text-brand-500 font-medium text-sm"
            >
              ← להחלטות
            </button>
          </div>
        </AppShell>
      </div>


      {/* Desktop view */}
      <div className={`hidden md:flex flex-col h-screen overflow-hidden bg-neutral-50 ${isResizing ? 'select-none' : ''}`}>

        {/* Plan sub-tabs (החלטות / פעילויות / לוח זמנים) */}
        <div className="px-5 pt-3 pb-0 bg-white border-b border-neutral-100 flex-shrink-0">
          <PlanSubNav />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-neutral-200 flex-shrink-0">
          <button onClick={() => navigate(`/trip/${tripId}/home`)} className="text-sm text-neutral-500 hover:text-neutral-800 font-medium">← בית</button>
          <div className="w-px h-5 bg-neutral-200" />
          <h1 className="font-bold text-neutral-900">📅 מתכנן טיול — {currentTrip?.name}</h1>
          <span className="text-xs text-neutral-400 mr-auto">
            {aiDraft
              ? 'מצב תצוגה מקדימה של AI — אשרו או בטלו'
              : 'גרור פעילות לתוך יום | לחץ על תא לאירוע ידני | גרור אירוע להזזה/שינוי זמן'}
          </span>
          {!aiDraft && (
            <button
              type="button"
              onClick={runAiSchedule}
              disabled={aiLoading}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex-shrink-0"
              title="סידור לפי הצבעות (MUST קודם) + חלונות פתיחה — ללא חורים/סגירות"
            >
              {aiLoading ? '⏳ מסדר לפי הצבעות…' : '✨ סידור חכם לפי הצבעות'}
            </button>
          )}
          {eventsWithHoursIssues.length > 0 && (
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                criticalHoursCount
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-800'
              }`}
              title="אירועים עם בעיית שעות פתיחה"
            >
              {criticalHoursCount ? '🚫' : '⚠️'} {eventsWithHoursIssues.length} שעות
            </span>
          )}
        </div>

        {/* AI draft confirm bar */}
        {aiDraft && (
          <div className="px-5 py-3 border-b border-purple-200 bg-purple-50 flex flex-col gap-2 flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-purple-900">✨ הצעת לוח AI (טיוטה — עדיין לא נשמר)</p>
                <p className="text-xs text-purple-800 mt-0.5 leading-relaxed">{aiDraft.summaryHe}</p>
                {aiDraft.voteStats && (
                  <p className="text-[11px] text-purple-600 mt-1">
                    {aiDraft.voteStats.activities} פעילויות · {aiDraft.voteStats.withVotes} עם הצבעות ·{' '}
                    {events.filter((e) => String(e.id).startsWith('draft-')).length} שובצו בטיוטה
                    {aiDraft.skipped.length > 0 ? ` · ${aiDraft.skipped.length} דולגו` : ''}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={cancelAiSchedule}
                  disabled={aiApplying}
                  className="text-xs font-bold px-4 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  ביטול — שחזר
                </button>
                <button
                  type="button"
                  onClick={confirmAiSchedule}
                  disabled={aiApplying}
                  className="text-xs font-bold px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {aiApplying ? 'שומר…' : 'אישור — שמור ללוח'}
                </button>
              </div>
            </div>
            {aiDraft.skipped.length > 0 && (
              <details className="text-[11px] text-purple-700">
                <summary className="cursor-pointer font-semibold">
                  פעילויות שלא שובצו ({aiDraft.skipped.length})
                </summary>
                <ul className="mt-1 space-y-0.5 pr-2">
                  {aiDraft.skipped.slice(0, 12).map((s) => (
                    <li key={s.activityId}>
                      <strong>{s.name}</strong> — {s.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {eventsWithHoursIssues.length > 0 && (
          <div
            className={`px-5 py-2 border-b text-xs flex flex-wrap gap-x-4 gap-y-1 ${
              criticalHoursCount
                ? 'bg-red-50 border-red-100 text-red-800'
                : 'bg-amber-50 border-amber-100 text-amber-900'
            }`}
          >
            <span className="font-bold flex-shrink-0">
              {criticalHoursCount ? '🚫 מקומות שכנראה סגורים בזמן המתוכנן:' : '⚠️ בדקו שעות פתיחה:'}
            </span>
            {eventsWithHoursIssues.slice(0, 5).map((ev) => (
              <span key={ev.id} className="truncate max-w-[14rem]">
                <strong>{ev.title}</strong> ({fmtDate(ev.date)} {fmtMin(ev.startMinute)})
              </span>
            ))}
            {eventsWithHoursIssues.length > 5 && (
              <span>+{eventsWithHoursIssues.length - 5} נוספים</span>
            )}
          </div>
        )}

        <div className="flex flex-1 min-h-0">

          {/* ── Left Panel: Activities ── */}
          <div
            className="flex-shrink-0 flex flex-col border-l border-neutral-200 bg-white relative"
            style={{ width: `${sidebarWidth}px`, flexBasis: `${sidebarWidth}px` }}
          >
            {/* Resize handle - on LEFT edge (between sidebar and calendar) */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="שינוי רוחב סרגל הפעילויות"
              title="גררו לשינוי רוחב"
              className="absolute top-0 left-0 bottom-0 w-4 -translate-x-1/2 cursor-col-resize hover:bg-brand-500/20 active:bg-brand-500/30 transition-colors z-30 flex items-center justify-center group"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsResizing(true);
                const startX = e.clientX;
                const startWidth = sidebarWidthRef.current;
                let nextWidth = startWidth;

                const handleMouseMove = (moveE: MouseEvent) => {
                  moveE.preventDefault();
                  const delta = startX - moveE.clientX;
                  nextWidth = clamp(startWidth + delta, SIDEBAR_MIN_W, SIDEBAR_MAX_W);
                  sidebarWidthRef.current = nextWidth;
                  setSidebarWidth(nextWidth);
                };

                const handleMouseUp = () => {
                  setIsResizing(false);
                  localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(nextWidth));
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                  document.body.style.cursor = '';
                  document.body.style.userSelect = '';
                };

                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            >
              {/* Visual grip indicator - three vertical dots */}
              <div className={`flex flex-col gap-1 rounded-full bg-white/75 px-1 py-1.5 shadow-sm ring-1 ring-neutral-200 transition-opacity ${isResizing ? "opacity-100" : "opacity-45 group-hover:opacity-100"}`}>
                <div className="w-1 h-1 rounded-full bg-neutral-400" />
                <div className="w-1 h-1 rounded-full bg-neutral-400" />
                <div className="w-1 h-1 rounded-full bg-neutral-400" />
              </div>
            </div>

            {/* Panel header */}
            <div className="px-4 py-3 border-b border-neutral-200">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold text-sm text-neutral-800">📦 פעילויות</h2>
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/trip/${tripId}/plan/activities`)} className="text-xs text-purple-600 font-medium hover:text-purple-800">🗳️ שאלון</button>
                  <button onClick={() => setModal({ type: 'addActivity' })} className="text-xs text-brand-500 font-medium hover:text-brand-700">+ הוסף</button>
                </div>
              </div>
              <p className="text-xs text-neutral-400">גרור לתוך יום בלוח</p>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-neutral-100">
              <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5">
                <span className="text-neutral-400 text-xs">🔍</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="חיפוש פעילות..."
                  className="flex-1 text-xs bg-transparent focus:outline-none text-neutral-700 placeholder-neutral-400"
                />
                {search && <button onClick={() => setSearch('')} className="text-neutral-400 hover:text-neutral-600 text-xs leading-none">✕</button>}
              </div>
            </div>
            {/* Filters — only when the bank has categorized activities */}
            {filterCats.length > 0 && (
              <div className="flex gap-1 flex-wrap px-3 py-2 border-b border-neutral-100">
                <button onClick={() => setFilter('all')} className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${filter === 'all' ? 'bg-brand-500 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>הכל</button>
                {filterCats.map(c => (
                  <button key={c.id} onClick={() => setFilter(c.id)} className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${filter === c.id ? 'bg-brand-500 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>{c.label}</button>
                ))}
              </div>
            )}

            {/* Activity list */}
            <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1.5">
              {loading ? (
                <p className="text-xs text-neutral-400 text-center py-8">טוען...</p>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 px-3">
                  <p className="text-sm text-neutral-500 mb-3">אין פעילויות עדיין</p>
                  <button onClick={() => setModal({ type: 'addActivity' })} className="text-xs bg-brand-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-600">
                    + הוסף פעילות
                  </button>
                  <p className="text-xs text-neutral-400 mt-2">הוסיפו מקומות ואטרקציות לטיול שלכם</p>
                </div>
              ) : visibleActs.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-4">אין פעילויות בקטגוריה זו</p>
              ) : (
                visibleActs.map(act => (
                  <ActivityCard
                    key={act.id}
                    activity={act}
                    onDragStart={() => { dragActId.current = act.id; }}
                    onDragEnd={() => { dragActId.current = null; }}
                    onEdit={() => setModal({ type: 'editActivity', activity: act })}
                    onAddToMap={() => handleAddToMap(act.name, act.location, act.mapsUrl, act.category)}
                  />
                ))
              )}

              {activities.length > 0 && (
                <button onClick={() => setModal({ type: 'addActivity' })} className="text-xs text-brand-500 hover:text-brand-700 font-medium py-2 text-center">+ הוסף פעילות</button>
              )}
            </div>

          {/* Add-to-map banner */}
          {addToMap && (
            <div className="absolute bottom-2 left-2 right-2 z-50 bg-white border border-neutral-200 rounded-2xl shadow-xl px-4 py-3" dir="rtl">
              {addToMap.status === 'geocoding' && (
                <p className="text-xs text-neutral-600 flex items-center gap-2">⏳ מחפש מיקום...</p>
              )}
              {addToMap.status === 'confirm' && (
                <div>
                  <p className="text-xs font-semibold text-neutral-800 mb-0.5 truncate">📍 {addToMap.displayName}</p>
                  <p className="text-[11px] text-neutral-500 mb-2">הוסף למפת הטיול?</p>
                  <div className="flex gap-2">
                    <button onClick={confirmAddToMap}
                      className="flex-1 py-1.5 text-xs font-bold bg-brand-500 text-white rounded-xl hover:bg-brand-600">כן ✓</button>
                    <button onClick={() => setAddToMap(null)}
                      className="flex-1 py-1.5 text-xs text-neutral-500 border border-neutral-200 rounded-xl hover:bg-neutral-50">לא</button>
                  </div>
                </div>
              )}
              {addToMap.status === 'saving' && (
                <p className="text-xs text-neutral-600 flex items-center gap-2">⏳ שומר...</p>
              )}
              {addToMap.status === 'done' && (
                <p className="text-xs text-green-600 font-medium">✅ {addToMap.name} נוסף למפה!</p>
              )}
              {addToMap.status === 'error' && (
                <p className="text-xs text-red-500">❌ לא נמצא מיקום</p>
              )}
            </div>
          )}
          </div>{/* end left panel */}

          {/* ── Calendar Grid ── */}
          <div ref={calRef} className="flex-1 overflow-auto" style={{ direction: 'ltr' }}>
            <div style={{ minWidth: `${TIME_COL_W + days.length * 160}px` }}>

              {/* Sticky day headers */}
              <div className="sticky top-0 z-20 bg-white border-b border-neutral-200">
                {/* Day names row */}
                <div className="flex" style={{ height: DAY_HDR_H }}>
                  <div style={{ width: TIME_COL_W, flexShrink: 0 }} />
                  {days.map(date => (
                    <div key={date} className="flex-1 border-r border-neutral-200 flex flex-col items-center justify-center">
                      <span className="text-xs font-bold text-neutral-700">{fmtDate(date)}</span>
                      <span className="text-xs text-neutral-400">{events.filter(ev => ev.date === date && !ev.allDay).length} אירועים</span>
                      {weatherByDate[date] && (
                        <span className="text-[10px] text-neutral-500 mt-0.5" title={weatherByDate[date].rain != null ? `גשם ${weatherByDate[date].rain}%` : undefined}>
                          {weatherByDate[date].emoji} {weatherByDate[date].tempMax}°
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {/* All-day events row */}
                {events.some(ev => ev.allDay) && (
                  <div className="flex border-t border-neutral-100" style={{ minHeight: 28 }}>
                    <div style={{ width: TIME_COL_W, flexShrink: 0 }} className="flex items-center justify-end pr-2 pb-1">
                      <span className="text-[10px] text-neutral-400 font-medium">כל היום</span>
                    </div>
                    {days.map(date => {
                      const allDayEvts = events.filter(ev => ev.date === date && ev.allDay);
                      return (
                        <div key={date} className="flex-1 border-r border-neutral-200 px-1 py-1 flex flex-col gap-0.5">
                          {allDayEvts.map(ev => (
                            <AllDayEvent
                              key={ev.id}
                              event={ev}
                              onEdit={() => setModal({ type: 'editEvent', event: ev })}
                              onReturnToBank={ev.activityId ? () => deleteEvent(ev.id) : undefined}
                              onDelete={() => deleteEventFull(ev)}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Time grid */}
              <div className="flex relative" style={{ height: GRID_H }}>

                {/* Time labels */}
                <div className="flex-shrink-0 relative" style={{ width: TIME_COL_W }}>
                  {HOURS.map(h => (
                    <div key={h} className="absolute w-full flex items-start justify-end pr-2 text-xs text-neutral-400 font-medium" style={{ top: (h - START_HOUR) * PX_PER_HR - 8, height: PX_PER_HR }}>
                      {String(h).padStart(2,'0')}:00
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {days.map(date => (
                  <DayColumn
                    key={date}
                    date={date}
                    events={events.filter(ev => ev.date === date && !ev.allDay)}
                    onDragOver={handleCalDragOver}
                    onDrop={e => handleColDrop(e, date)}
                    onClick={e => handleColClick(e, date)}
                    colRef={el => { if (el) dayColRefs.current.set(date, el); else dayColRefs.current.delete(date); }}
                    onEventClick={ev => {
                      if (wasDragging.current) { wasDragging.current = false; return; }
                      setModal({ type: 'editEvent', event: ev });
                    }}
                    onEventMouseDown={(e, ev, type) => {
                      dragEvtState.current = { eventId: ev.id, type, startY: e.clientY, origMin: ev.startMinute, origDur: ev.durationMins, origDate: ev.date };
                    }}
                    onEventEdit={ev => setModal({ type: 'editEvent', event: ev })}
                    onEventReturnToBank={ev => deleteEvent(ev.id)}
                    onEventDeleteFull={ev => deleteEventFull(ev)}
                    onEventAddToMap={ev => handleAddToMap(ev.title, undefined, ev.mapsUrl)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {modal.type === 'addActivity' && (
        <ActivityModal tripId={tripId!} onSave={saveActivity} onClose={() => setModal({ type: 'none' })} />
      )}
      {modal.type === 'editActivity' && (
        <ActivityModal tripId={tripId!} activity={modal.activity} onSave={saveActivity} onDelete={deleteActivity} onClose={() => setModal({ type: 'none' })} />
      )}
      {(modal.type === 'addEvent' || modal.type === 'editEvent') && (
        <EventModal
          tripId={tripId!}
          event={modal.type === 'editEvent' ? modal.event : undefined}
          defaultDate={modal.type === 'addEvent' ? modal.date : undefined}
          defaultStartMinute={modal.type === 'addEvent' ? modal.startMinute : undefined}
          defaultTitle={modal.type === 'addEvent' ? modal.title : undefined}
          defaultColor={modal.type === 'addEvent' ? modal.color : undefined}
          defaultDuration={modal.type === 'addEvent' ? modal.durationMins : undefined}
          defaultActivityId={modal.type === 'addEvent' ? modal.activityId : undefined}
          defaultUrl={modal.type === 'addEvent' ? modal.url : undefined}
          defaultMapsUrl={modal.type === 'addEvent' ? modal.mapsUrl : undefined}
          defaultCost={modal.type === 'addEvent' ? modal.cost : undefined}
          defaultCategory={modal.type === 'addEvent' ? modal.category : undefined}
          defaultLocation={modal.type === 'addEvent' ? modal.location : undefined}
          days={days}
          onSave={saveEvent}
          onDelete={modal.type === 'editEvent' ? deleteEvent : undefined}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
    </>
  );
};

// ─── Activity Card ─────────────────────────────────────────────────────────────

const ActivityCard: React.FC<{
  activity: Activity;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onAddToMap: () => void;
}> = ({ activity: act, onDragStart, onDragEnd, onEdit, onAddToMap }) => {
  const c = col(act.color);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="rounded-xl border border-neutral-200 bg-white px-2.5 py-2 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow select-none group"
    >
      {/* Row 1: emoji + name + actions */}
      <div className="flex items-center gap-1.5">
        <span className="text-base flex-shrink-0">{act.emoji}</span>
        <span className="text-xs font-bold text-neutral-800 leading-snug flex-1 truncate">{act.name}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAddToMap(); }}
          title="הוסף למפה"
          className={`${iconBtnGhost} opacity-0 group-hover:opacity-100`}
        >
          <Icon name="pin" size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="עריכה"
          className={`${iconBtnGhost} opacity-0 group-hover:opacity-100`}
        >
          <Icon name="edit" size={14} />
        </button>
      </div>
      {/* Row 2: meta + outline icons */}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${c.pill}`}>
          {catLabel(act.category)}
        </span>
        {act.cost && <span className="text-xs font-medium text-neutral-600">{act.cost}</span>}
        <span className="inline-flex items-center gap-0.5 text-xs text-neutral-400">
          <Icon name="clock" size={12} className="text-neutral-400" />
          {act.estimatedDuration || fmtDur(act.durationMins)}
        </span>
        {act.openingHours === null && (
          <span className="text-xs font-medium text-green-600" title="פתוח 24/7">24/7</span>
        )}
        {act.rating && (
          <span className="text-xs font-medium text-amber-600">⭐ {act.rating.toFixed(1)}</span>
        )}
        {act.url && (
          <a
            href={act.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="קישור"
            className={iconBtnGhost}
          >
            <Icon name="link" size={13} />
          </a>
        )}
        {act.mapsUrl && (
          <a
            href={act.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="מפה"
            className={iconBtnGhost}
          >
            <Icon name="map" size={13} />
          </a>
        )}
        {act.files?.length > 0 && (
          <span className="inline-flex items-center gap-0.5 text-xs text-neutral-400" title="קבצים">
            <Icon name="paperclip" size={12} className="text-neutral-400" />
            {act.files.length}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── All-Day Event chip ───────────────────────────────────────────────────────

const AllDayEvent: React.FC<{
  event: CalEvent;
  onEdit: () => void;
  onReturnToBank?: () => void;
  onDelete: () => void;
}> = ({ event: ev, onEdit, onReturnToBank, onDelete }) => {
  const c = col(ev.color);
  return (
    <div
      className={`group flex items-center justify-between rounded px-1.5 py-0.5 text-xs font-medium cursor-pointer ${c.event} ${c.text}`}
      onClick={onEdit}
    >
      <span className="truncate flex-1">{ev.title}</span>
      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 flex-shrink-0 ml-1">
        {ev.url && (
          <a
            href={ev.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="קישור"
            className={iconBtnSm}
          >
            <Icon name="link" size={12} />
          </a>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="עריכה" className={iconBtnSm}>
          <Icon name="edit" size={12} />
        </button>
        {onReturnToBank && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onReturnToBank(); }} title="החזר לבנק" className={iconBtnSm}>
            <Icon name="undo" size={12} />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(ev.activityId ? 'למחוק אירוע ופעילות לצמיתות?' : 'למחוק אירוע?')) onDelete();
          }}
          title="מחק"
          className={`${iconBtnSm} hover:text-red-600 hover:bg-red-50`}
        >
          <Icon name="trash" size={12} />
        </button>
      </div>
    </div>
  );
};

// ─── Day Column ────────────────────────────────────────────────────────────────

/** Side-by-side layout for overlapping events (Google-Calendar style).
 *  Groups transitively-overlapping events into clusters, assigns each event a
 *  column, and returns left/width percentages per event id. */
function layoutDayEvents(events: CalEvent[]): Map<string, { leftPct: number; widthPct: number }> {
  const out = new Map<string, { leftPct: number; widthPct: number }>();
  if (!events.length) return out;

  const sorted = [...events].sort(
    (a, b) => a.startMinute - b.startMinute || b.durationMins - a.durationMins,
  );

  let cluster: CalEvent[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    // Greedy column assignment inside the cluster
    const colEnds: number[] = []; // end minute of last event in each column
    const colOf = new Map<string, number>();
    for (const ev of cluster) {
      const start = ev.startMinute;
      const end = ev.startMinute + Math.max(ev.durationMins, 1);
      let placed = -1;
      for (let i = 0; i < colEnds.length; i++) {
        if (colEnds[i] <= start) { placed = i; break; }
      }
      if (placed === -1) { placed = colEnds.length; colEnds.push(end); }
      else colEnds[placed] = end;
      colOf.set(ev.id, placed);
    }
    const n = colEnds.length;
    for (const ev of cluster) {
      const idx = colOf.get(ev.id) ?? 0;
      out.set(ev.id, { leftPct: (idx * 100) / n, widthPct: 100 / n });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const ev of sorted) {
    const start = ev.startMinute;
    const end = ev.startMinute + Math.max(ev.durationMins, 1);
    // If new event starts at or after cluster ends, flush previous cluster
    if (cluster.length && start >= clusterEnd) {
      flush();
    }
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();

  return out;
}

const DayColumn: React.FC<{
  date: string;
  events: CalEvent[];
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onEventClick: (ev: CalEvent) => void;
  onEventMouseDown: (e: React.MouseEvent, ev: CalEvent, type: 'move' | 'resize') => void;
  onEventEdit: (ev: CalEvent) => void;
  onEventReturnToBank: (ev: CalEvent) => void;
  onEventDeleteFull: (ev: CalEvent) => void;
  onEventAddToMap: (ev: CalEvent) => void;
  colRef: (el: HTMLDivElement | null) => void;
}> = ({ date: _date, events, onDragOver, onDrop, onClick, onEventClick, onEventMouseDown, onEventEdit, onEventReturnToBank, onEventDeleteFull, onEventAddToMap, colRef }) => {
  const layout = useMemo(() => layoutDayEvents(events), [events]);
  return (
  <div
    ref={colRef}
    className="flex-1 border-r border-neutral-200 relative cursor-crosshair overflow-hidden"
    style={{ height: GRID_H }}
    onDragOver={onDragOver}
    onDrop={onDrop}
    onClick={onClick}
  >
    {/* Hour lines */}
    {HOURS.map(h => (
      <div key={h} className="absolute w-full border-t border-neutral-200" style={{ top: (h - START_HOUR) * PX_PER_HR }} />
    ))}
    {/* Half-hour lines */}
    {HOURS.map(h => (
      <div key={`${h}h`} className="absolute w-full border-t border-neutral-100" style={{ top: (h - START_HOUR) * PX_PER_HR + PX_PER_HR / 2 }} />
    ))}

    {/* Events */}
    {events.map(ev => (
      <CalendarEvent
        key={ev.id}
        event={ev}
        layout={layout.get(ev.id)}
        onClick={() => onEventClick(ev)}
        onMouseDown={(e, type) => { e.stopPropagation(); onEventMouseDown(e, ev, type); }}
        onEdit={() => onEventEdit(ev)}
        onReturnToBank={ev.activityId ? () => onEventReturnToBank(ev) : undefined}
        onDelete={() => onEventDeleteFull(ev)}
        onAddToMap={() => onEventAddToMap(ev)}
      />
    ))}
  </div>
  );
};

// ─── Calendar Event ───────────────────────────────────────────────────────────

const FilesPopup: React.FC<{ files: EventFile[]; onClose: () => void }> = ({ files, onClose }) => (
  <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4" onClick={e => { e.stopPropagation(); onClose(); }} onMouseDown={e => e.stopPropagation()}>
    <div className="absolute inset-0 bg-black/30" />
    <div className="relative bg-white rounded-2xl shadow-2xl p-4 w-72" dir="rtl" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-neutral-800 inline-flex items-center gap-1.5">
          <Icon name="paperclip" size={15} className="text-neutral-600" />
          קבצים מצורפים
        </h3>
        <button type="button" onClick={onClose} className={iconBtnGhost} title="סגור">
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {files.map(f => {
          const isImage = f.mimeType.startsWith('image/');
          const href = `/uploads/planner/${f.filename}`;
          return (
            <a key={f.id} href={href} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-neutral-50 hover:bg-brand-50 border border-neutral-100 hover:border-brand-200 transition-colors group">
              <Icon name={isImage ? 'image' : 'file'} size={16} className="text-neutral-500 flex-shrink-0" />
              <span className="text-xs text-neutral-700 group-hover:text-brand-700 truncate flex-1">{f.originalName}</span>
              <Icon name="external" size={12} className="text-neutral-400 flex-shrink-0" />
            </a>
          );
        })}
      </div>
    </div>
  </div>
);

const CalendarEvent: React.FC<{
  event: CalEvent;
  layout?: { leftPct: number; widthPct: number };
  onClick: () => void;
  onMouseDown: (e: React.MouseEvent, type: 'move' | 'resize') => void;
  onEdit: () => void;
  onReturnToBank?: () => void;
  onDelete: () => void;
  onAddToMap: () => void;
}> = ({ event: ev, layout, onClick, onMouseDown, onEdit, onReturnToBank, onDelete, onAddToMap }) => {
  const [showFiles, setShowFiles] = useState(false);
  const top    = minToY(ev.startMinute);
  const height = Math.max(20, Math.min(ev.durationMins * PX_PER_MIN, GRID_H - top));
  const c      = col(ev.color);

  const short  = height < 44;  // title only
  const tall   = height >= 76; // title + icons + time + notes
  const narrow = layout && layout.widthPct < 100; // overlapping with others
  const hoursIssue =
    ev.scheduleSeverity ||
    (ev.scheduleWarnings?.some((w) => w.severity === 'critical')
      ? 'critical'
      : ev.scheduleWarnings?.length
        ? 'warn'
        : null);
  const hoursBorder =
    hoursIssue === 'critical'
      ? 'ring-2 ring-red-500 border-red-500'
      : hoursIssue === 'warn'
        ? 'ring-2 ring-amber-400 border-amber-400'
        : '';
  const hoursTitle = ev.scheduleWarnings?.map((w) => w.message).join('\n');
  const isDraft = String(ev.id).startsWith('draft-');

  return (
    <div
      className={`cal-event absolute rounded-lg border ${c.event} ${c.border} ${c.text} overflow-hidden cursor-grab active:cursor-grabbing transition-all select-none ${hoursBorder} ${
        isDraft ? 'border-dashed border-purple-500 ring-1 ring-purple-300/80 opacity-95' : ''
      }`}
      style={{
        top,
        height,
        left: `calc(${layout?.leftPct ?? 0}% + 2px)`,
        width: `calc(${layout?.widthPct ?? 100}% - 4px)`,
      }}
      onClick={onClick}
      onMouseDown={e => onMouseDown(e, 'move')}
      title={hoursTitle || (isDraft ? 'טיוטת AI — טרם נשמר' : undefined)}
    >
      {isDraft && (
        <span className="absolute top-0.5 right-0.5 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-600 text-white shadow-sm">
          AI
        </span>
      )}
      {hoursIssue && (
        <span
          className={`absolute top-0.5 left-0.5 z-10 inline-flex items-center justify-center w-5 h-5 rounded-md shadow-sm ${
            hoursIssue === 'critical' ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-950'
          }`}
          title={hoursTitle || undefined}
        >
          <Icon name="alert" size={12} />
        </span>
      )}
      <div className="px-1.5 pt-0.5 pb-3 leading-tight flex flex-col gap-0.5">
        {/* Title only */}
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-semibold truncate flex-1" title={`ID: ${ev.id}, Title: ${ev.title}, ActivityID: ${ev.activityId}`}>{ev.title}</p>
        </div>
        {/* Time row */}
        {tall && (
          <p className="text-xs opacity-60 inline-flex items-center gap-1">
            <Icon name="clock" size={11} className="opacity-70" />
            {fmtMin(ev.startMinute)} – {fmtMin(ev.startMinute + ev.durationMins)}
          </p>
        )}
        {/* Soft modern action chips */}
        {!short && !narrow && (
          <div
            className="flex items-center gap-1 flex-wrap mt-1"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {ev.url?.trim() && (
              <a href={ev.url} target="_blank" rel="noopener noreferrer" title="קישור" className={iconBtn}>
                <Icon name="link" size={14} />
              </a>
            )}
            {ev.mapsUrl?.trim() && (
              <a href={ev.mapsUrl} target="_blank" rel="noopener noreferrer" title="מפה" className={iconBtn}>
                <Icon name="map" size={14} />
              </a>
            )}
            {ev.files && ev.files.length === 1 && (
              <a
                href={`/uploads/planner/${ev.files[0].filename}`}
                target="_blank"
                rel="noopener noreferrer"
                className={iconBtn}
                title={ev.files[0].originalName}
              >
                <Icon name="paperclip" size={14} />
              </a>
            )}
            {ev.files && ev.files.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowFiles(true); }}
                onMouseDown={(e) => e.stopPropagation()}
                title="קבצים מצורפים"
                className={`${iconBtn} gap-0.5 text-[10px] font-semibold tabular-nums`}
              >
                <Icon name="paperclip" size={14} />
                {ev.files.length}
              </button>
            )}
            <button type="button" onClick={(e) => { e.stopPropagation(); onAddToMap(); }} onMouseDown={(e) => e.stopPropagation()} title="הוסף למפה" className={iconBtn}>
              <Icon name="pin" size={14} />
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} onMouseDown={(e) => e.stopPropagation()} title="עריכה" className={iconBtn}>
              <Icon name="edit" size={14} />
            </button>
            {onReturnToBank && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onReturnToBank(); }} onMouseDown={(e) => e.stopPropagation()} title="החזר לבנק" className={iconBtn}>
                <Icon name="undo" size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(ev.activityId ? 'למחוק אירוע ופעילות לצמיתות?' : 'למחוק אירוע?')) onDelete();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              title="מחק"
              className={iconBtnDanger}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        )}
        {/* Notes */}
        {tall && ev.notes?.trim() && <p className="text-xs opacity-60 line-clamp-2">{ev.notes}</p>}
        {tall && hoursIssue && ev.scheduleWarnings?.[0] && (
          <p className={`text-[10px] font-medium line-clamp-2 inline-flex items-start gap-1 ${hoursIssue === 'critical' ? 'text-red-700' : 'text-amber-800'}`}>
            <Icon name="alert" size={11} className="mt-0.5 flex-shrink-0" />
            <span>{ev.scheduleWarnings[0].message}</span>
          </p>
        )}
      </div>
      {/* Resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex items-center justify-center"
        onMouseDown={e => { e.stopPropagation(); onMouseDown(e, 'resize'); }}
      >
        <div className="w-6 h-0.5 rounded bg-current opacity-40" />
      </div>
      {showFiles && ev.files && <FilesPopup files={ev.files} onClose={() => setShowFiles(false)} />}
    </div>
  );
};

// ─── Activity Modal ───────────────────────────────────────────────────────────

const ActivityModal: React.FC<{
  activity?: Activity;
  tripId: string;
  onSave: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}> = ({ activity, tripId, onSave, onDelete, onClose }) => {
  const [name, setName]         = useState(activity?.name ?? '');
  const [emoji, setEmoji]       = useState(activity?.emoji ?? '📌');
  const [location, setLocation] = useState(activity?.location ?? '');
  const [desc, setDesc]         = useState(activity?.description ?? '');
  const [dur, setDur]           = useState(String(activity?.durationMins ?? 60));
  const [cost, setCost]         = useState(activity?.cost ?? '');
  const [category, setCategory] = useState(activity?.category ?? 'other');
  const [mapsUrl, setMapsUrl]   = useState(activity?.mapsUrl ?? '');
  const [url, setUrl]           = useState(activity?.url ?? '');
  const [saving, setSaving]     = useState(false);
  const [files, setFiles]       = useState<ActivityFile[]>(activity?.files ?? []);
  const [uploading, setUploading] = useState(false);

  const color = catColor(category);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ id: activity?.id, name, emoji, location: location || undefined, description: desc || undefined, durationMins: parseInt(dur) || 60, cost: cost || undefined, category, mapsUrl: mapsUrl || undefined, url: url || undefined, color });
    } finally { setSaving(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activity) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const r = await apiClient.post(`/api/planner/${tripId}/activities/${activity.id}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFiles(prev => [...prev, r.data.file]);
    } catch { /* silent */ }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!activity) return;
    await apiClient.delete(`/api/planner/${tripId}/activities/${activity.id}/files/${fileId}`).catch(() => {});
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const inp = 'border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500';

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-bold text-neutral-900 mb-4">{activity ? 'עריכת פעילות' : 'פעילות חדשה'}</h2>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input value={emoji} onChange={e => setEmoji(e.target.value)} className="w-16 text-center text-2xl border border-neutral-200 rounded-xl p-2" maxLength={2} />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="שם הפעילות *" className={`flex-1 ${inp}`} />
        </div>
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="מיקום (אופציונלי)" className={inp} />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="תיאור קצר (אופציונלי)" rows={2} className={`${inp} resize-none`} />
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-neutral-500 mb-1 block">משך (דקות)</label>
            <input type="number" value={dur} onChange={e => setDur(e.target.value)} min={15} step={15} className={`w-full ${inp}`} />
          </div>
          <div className="flex-1">
            <label className="text-xs text-neutral-500 mb-1 block">מחיר</label>
            <input value={cost} onChange={e => setCost(e.target.value)} placeholder="חינם / €15" className={`w-full ${inp}`} />
          </div>
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">קטגוריה</label>
          <div className="flex flex-wrap gap-1.5">
            {CATS.map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)} className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${category === c.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-neutral-200 text-neutral-600'}`}>{c.label}</button>
            ))}
          </div>
        </div>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="🔗 קישור כללי (אופציונלי)" className={inp} />
        <input value={mapsUrl} onChange={e => setMapsUrl(e.target.value)} placeholder="🗺️ קישור Google Maps (אופציונלי)" className={inp} />

        {/* Files — only when editing */}
        {activity ? (
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">קבצים מצורפים</label>
            {files.length > 0 && (
              <div className="flex flex-col gap-1 mb-2">
                {files.map(f => {
                  const isImage = f.mimeType.startsWith('image/');
                  const href = `/uploads/planner/${f.filename}`;
                  return (
                    <div key={f.id} className="flex items-center gap-2 bg-neutral-50 rounded-lg px-2 py-1.5">
                      {isImage && <img src={href} alt={f.originalName} className="w-8 h-8 object-cover rounded" />}
                      {!isImage && <span className="text-base">📄</span>}
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate flex-1">{f.originalName}</a>
                      <button onClick={() => handleDeleteFile(f.id)} className="text-neutral-400 hover:text-red-400 text-xs flex-shrink-0">✕</button>
                    </div>
                  );
                })}
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-brand-500 font-medium hover:text-brand-700">
              <input type="file" onChange={handleFileUpload} className="hidden" accept="image/*,.pdf" disabled={uploading} />
              {uploading ? '⏳ מעלה...' : '+ הוסף קובץ (תמונה / PDF)'}
            </label>
          </div>
        ) : (
          <p className="text-xs text-neutral-400">ניתן לצרף קבצים לאחר שמירה</p>
        )}
      </div>

      <div className="flex gap-2 mt-5">
        {onDelete && activity && (
          <button onClick={() => { if (confirm('למחוק פעילות?')) onDelete(activity.id); }} className="text-sm text-red-400 px-3 py-2 rounded-xl hover:bg-red-50">מחק</button>
        )}
        <button onClick={onClose} className="flex-1 text-sm text-neutral-600 border border-neutral-200 rounded-xl py-2.5">ביטול</button>
        <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 text-sm font-bold bg-brand-500 text-white rounded-xl py-2.5 disabled:opacity-50 hover:bg-brand-600">
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </ModalOverlay>
  );
};

// ─── Event Modal ──────────────────────────────────────────────────────────────

const EventModal: React.FC<{
  tripId: string;
  event?: CalEvent;
  defaultDate?: string;
  defaultStartMinute?: number;
  defaultTitle?: string;
  defaultColor?: string;
  defaultDuration?: number;
  defaultActivityId?: string;
  defaultUrl?: string;
  defaultMapsUrl?: string;
  defaultCost?: string;
  defaultCategory?: string;
  defaultLocation?: string;
  days: string[];
  onSave: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}> = ({ tripId, event, defaultDate, defaultStartMinute, defaultTitle, defaultColor, defaultDuration, defaultActivityId, defaultUrl, defaultMapsUrl, defaultCost, defaultCategory, defaultLocation, days, onSave, onDelete, onClose }) => {
  const initStart  = event?.startMinute ?? defaultStartMinute ?? 540;
  const initDur    = event?.durationMins ?? defaultDuration ?? 60;
  const initEnd    = initStart + initDur;

  const [title,   setTitle]   = useState(event?.title   ?? defaultTitle   ?? '');
  const [date,    setDate]    = useState(event?.date    ?? defaultDate    ?? days[0] ?? '');
  const [allDay,  setAllDay]  = useState(event?.allDay  ?? false);
  const [startH,  setStartH]  = useState(String(Math.floor(initStart / 60)).padStart(2,'0'));
  const [startM,  setStartM]  = useState(String(initStart % 60).padStart(2,'0'));
  const [endH,    setEndH]    = useState(String(Math.floor(Math.min(initEnd, 1439) / 60)).padStart(2,'0'));
  const [endM,    setEndM]    = useState(String(Math.min(initEnd, 1439) % 60).padStart(2,'0'));
  const [color,   setColor]   = useState(event?.color   ?? defaultColor   ?? 'blue');
  const [notes,   setNotes]   = useState(event?.notes   ?? '');
  const [url,     setUrl]     = useState(event?.url     ?? defaultUrl     ?? '');
  const [mapsUrl, setMapsUrl] = useState(event?.mapsUrl ?? defaultMapsUrl ?? '');
  const [cost,    setCost]    = useState(event?.cost    ?? defaultCost    ?? '');
  const [files,   setFiles]   = useState<EventFile[]>(event?.files ?? []);
  const [saving,  setSaving]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [serverWarnings, setServerWarnings] = useState<ScheduleWarning[]>(event?.scheduleWarnings ?? []);
  const [checkingHours, setCheckingHours] = useState(false);

  const startMinute = (parseInt(startH, 10) || 0) * 60 + (parseInt(startM, 10) || 0);
  const endMinute   = (parseInt(endH, 10) || 0) * 60 + (parseInt(endM, 10) || 0);
  const durationMins = Math.max(15, endMinute > startMinute ? endMinute - startMinute : 60);

  // Live Google + heuristics check whenever schedule fields change
  useEffect(() => {
    if (!tripId || !title.trim() || !date || allDay) {
      setServerWarnings([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setCheckingHours(true);
      try {
        const { data } = await apiClient.post(`/api/planner/${tripId}/check-hours`, {
          title: title.trim(),
          date,
          startMinute,
          durationMins,
          allDay: false,
          activityId: event?.activityId ?? defaultActivityId,
          mapsUrl: mapsUrl.trim() || null,
          location: defaultLocation || null,
          category: defaultCategory || null,
        });
        if (!cancelled) setServerWarnings(data.scheduleWarnings ?? []);
      } catch {
        if (!cancelled) setServerWarnings([]);
      } finally {
        if (!cancelled) setCheckingHours(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [tripId, title, date, startMinute, durationMins, allDay, mapsUrl, event?.activityId, defaultActivityId, defaultCategory, defaultLocation]);

  const handleSave = async () => {
    if (!title.trim()) return;
    if (serverWarnings.some((w) => w.severity === 'critical')) {
      const ok = window.confirm(
        '🚫 המקום כנראה סגור בזמן הזה:\n\n' +
          serverWarnings.map((w) => '• ' + w.message).join('\n\n') +
          '\n\nלשמור בכל זאת?',
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      await onSave({
        id: event?.id, activityId: event?.activityId ?? defaultActivityId,
        title, date, allDay,
        startMinute: allDay ? 0 : startMinute,
        durationMins: allDay ? 1440 : durationMins,
        color, notes: notes.trim() || null, url: url.trim() || null,
        mapsUrl: mapsUrl.trim() || null, cost: cost.trim() || null,
        category: defaultCategory,
        location: defaultLocation,
      });
    } finally { setSaving(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !event) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const r = await apiClient.post(`/api/planner/${tripId}/events/${event.id}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFiles(prev => [...prev, r.data.file]);
    } catch { /* silent */ }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!event) return;
    await apiClient.delete(`/api/planner/${tripId}/events/${event.id}/files/${fileId}`).catch(() => {});
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const COLOR_OPTS = Object.keys(COLORS);
  const timeInput = 'flex items-center gap-1 border border-neutral-200 rounded-xl px-3 py-2' as const;
  const inp = 'border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500' as const;

  const critical = serverWarnings.some((w) => w.severity === 'critical');
  const showClosedBanner = serverWarnings.length > 0;

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-bold text-neutral-900 mb-4">{event ? 'עריכת אירוע' : 'אירוע חדש'}</h2>
      {checkingHours && (
        <p className="mb-2 text-xs text-neutral-400">בודק שעות פתיחה מול Google…</p>
      )}
      {showClosedBanner && (
        <div
          className={`mb-3 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${
            critical
              ? 'border-red-400 bg-red-50 text-red-900'
              : 'border-amber-300 bg-amber-50 text-amber-950'
          }`}
        >
          <p className="font-bold mb-1 text-sm">
            {critical ? '🚫 המקום סגור בזמן הזה' : '⚠️ שימו לב לשעות פתיחה'}
          </p>
          {serverWarnings.map((w, i) => (
            <p key={i} className="mb-1 last:mb-0">
              {w.message}
              {w.hoursSummary && (
                <span className="block text-[11px] opacity-80 mt-0.5">שעות: {w.hoursSummary}</span>
              )}
              <span className="text-[10px] opacity-60">
                {' '}
                ({w.source === 'google' ? 'Google' : 'הערכה'})
              </span>
            </p>
          ))}
          <p className="mt-1.5 text-[11px] opacity-80">
            {critical
              ? 'מומלץ לשנות יום/שעה. אם תשמרו — תישלח התראה לקבוצה.'
              : 'כדאי לוודא לפני היציאה.'}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-3">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="כותרת *" className={inp} />

        <div>
          <label className="text-xs text-neutral-500 mb-1 block">יום</label>
          <select value={date} onChange={e => setDate(e.target.value)} className={`w-full ${inp}`}>
            {days.map(d => <option key={d} value={d}>{fmtDate(d)} ({d})</option>)}
          </select>
        </div>

        {/* All-day toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="w-4 h-4 accent-brand-500" />
          <span className="text-sm text-neutral-700">אירוע יום שלם (מלון, טיסה, ...)</span>
        </label>

        {/* Time pickers — hidden when allDay */}
        {!allDay && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-neutral-500 mb-1 block">שעת התחלה</label>
              <div className={timeInput} dir="ltr">
                <input type="number" value={startH} onChange={e => setStartH(String(Math.min(23, Math.max(0, parseInt(e.target.value) || 0))).padStart(2,'0'))} min={0} max={23} className="w-8 text-center text-sm focus:outline-none" />
                <span className="text-neutral-400">:</span>
                <select value={startM} onChange={e => setStartM(e.target.value)} className="text-sm focus:outline-none bg-transparent">
                  {['00','15','30','45'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs text-neutral-500 mb-1 block">שעת סיום</label>
              <div className={timeInput} dir="ltr">
                <input type="number" value={endH} onChange={e => setEndH(String(Math.min(23, Math.max(0, parseInt(e.target.value) || 0))).padStart(2,'0'))} min={0} max={23} className="w-8 text-center text-sm focus:outline-none" />
                <span className="text-neutral-400">:</span>
                <select value={endM} onChange={e => setEndM(e.target.value)} className="text-sm focus:outline-none bg-transparent">
                  {['00','15','30','45'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="🔗 קישור כללי (אופציונלי)" className={inp} />
        <input value={mapsUrl} onChange={e => setMapsUrl(e.target.value)} placeholder="🗺️ קישור Google Maps (אופציונלי)" className={inp} />
        <input value={cost} onChange={e => setCost(e.target.value)} placeholder="💰 מחיר (למשל €15, חינם)" className={inp} />

        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="תיאור (אופציונלי)" rows={2} className={`${inp} resize-none`} />

        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">צבע</label>
          <div className="flex gap-2 flex-wrap">
            {COLOR_OPTS.map(c => (
              <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? 'border-neutral-800 scale-110' : 'border-transparent'} ${COLORS[c].event}`} />
            ))}
          </div>
        </div>

        {/* Files — only when editing */}
        {event ? (
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">קבצים מצורפים</label>
            {files.length > 0 && (
              <div className="flex flex-col gap-1 mb-2">
                {files.map(f => {
                  const isImage = f.mimeType.startsWith('image/');
                  const href = `/uploads/planner/${f.filename}`;
                  return (
                    <div key={f.id} className="flex items-center gap-2 bg-neutral-50 rounded-lg px-2 py-1.5">
                      {isImage && <img src={href} alt={f.originalName} className="w-8 h-8 object-cover rounded" />}
                      {!isImage && <span className="text-base">📄</span>}
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate flex-1">{f.originalName}</a>
                      <button onClick={() => handleDeleteFile(f.id)} className="text-neutral-400 hover:text-red-400 text-xs flex-shrink-0">✕</button>
                    </div>
                  );
                })}
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-brand-500 font-medium hover:text-brand-700">
              <input type="file" onChange={handleFileUpload} className="hidden" accept="image/*,.pdf" disabled={uploading} />
              {uploading ? '⏳ מעלה...' : '+ הוסף קובץ (תמונה / PDF)'}
            </label>
          </div>
        ) : (
          <p className="text-xs text-neutral-400">ניתן לצרף קבצים לאחר שמירה</p>
        )}
      </div>

      <div className="flex gap-2 mt-5">
        {onDelete && event && (
          <button onClick={() => { if (confirm('למחוק אירוע?')) onDelete(event.id); }} className="text-sm text-red-400 px-3 py-2 rounded-xl hover:bg-red-50">מחק</button>
        )}
        <button onClick={onClose} className="flex-1 text-sm text-neutral-600 border border-neutral-200 rounded-xl py-2.5">ביטול</button>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className={`flex-1 text-sm font-bold text-white rounded-xl py-2.5 disabled:opacity-50 ${
            critical ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-500 hover:bg-brand-600'
          }`}
        >
          {saving ? 'שומר...' : critical ? '🚫 שמור בכל זאת' : 'שמור'}
        </button>
      </div>
    </ModalOverlay>
  );
};

// ─── Modal Overlay ─────────────────────────────────────────────────────────────

const ModalOverlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
      {children}
    </div>
  </div>
);
