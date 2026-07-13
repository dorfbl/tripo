import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui/Card';
import { useTripStore } from '../store/tripStore';
import { useActiveTripStore } from '../store/activeTripStore';
import { planSubPath } from '../lib/tripNav';
import { prefetchTripOffline } from '../lib/offline/cacheTrip';
import apiClient from '../api/client';

interface PlannerEvent {
  id: string;
  title: string;
  date: string;
  startMinute: number;
  durationMins: number;
  allDay?: boolean;
}

interface Settlement {
  from: { userId: string; name: string };
  to: { userId: string; name: string };
  amountILS: number;
}

interface DailyWeather {
  date: string;
  emoji: string;
  label: string;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number | null;
}

interface WeatherBundle {
  locationLabel: string;
  today: DailyWeather | null;
  tomorrow: DailyWeather | null;
  daily: DailyWeather[];
}

interface TripFlight {
  id: string;
  flightNumber: string;
  direction: string;
  airline?: string | null;
  departureAirport?: string | null;
  arrivalAirport?: string | null;
  departureAt?: string | null;
  flightDate?: string | null;
  minutesUntilDeparture?: number | null;
  statusLabel?: string | null;
  statusNote?: string | null;
  dateMatched?: boolean;
  liveData?: any;
}

interface AssistantTip {
  id: string;
  severity: 'info' | 'warn' | 'urgent';
  emoji: string;
  title: string;
  body: string;
  action?: { label: string; path: string };
}

const STATUS_LABEL: Record<string, string> = {
  PLAN: 'בתכנון',
  LIVE: 'בדרך!',
  FINISHED: 'הסתיים',
  CANCELED: 'בוטל',
};

const fmtMin = (m: number) => {
  const wrapped = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const fmtILS = (n: number) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tripDayIndex(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null;
  const s = new Date(start.slice(0, 10) + 'T12:00:00');
  const e = new Date(end.slice(0, 10) + 'T12:00:00');
  const t = new Date(todayIso() + 'T12:00:00');
  if (t < s) {
    const daysUntil = Math.round((s.getTime() - t.getTime()) / 86400000);
    return daysUntil === 0 ? 'מתחיל היום' : `עוד ${daysUntil} ימים ליציאה`;
  }
  if (t > e) return 'הטיול הסתיים';
  const dayNum = Math.round((t.getTime() - s.getTime()) / 86400000) + 1;
  const total = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return `יום ${dayNum} מתוך ${total}`;
}

function boardingLabel(mins: number | null | undefined): string | null {
  if (mins == null) return null;
  if (mins < 0) return 'המריאה / עבר';
  if (mins < 60) return `עלייה בעוד ${mins} דק׳`;
  if (mins < 180) return `עוד ${Math.round(mins / 60)} שע׳ לטיסה`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `עוד ${h} שע׳`;
  return `עוד ${Math.round(h / 24)} ימים`;
}

export const HomePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTrip, loadTrip, isLoading } = useTripStore();
  const { setActiveTrip } = useActiveTripStore();

  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [openDecisions, setOpenDecisions] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [todaySpend, setTodaySpend] = useState(0);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [timelinePreview, setTimelinePreview] = useState<
    { id: string; emoji: string; title: string; occurredAt: string }[]
  >([]);
  const [weather, setWeather] = useState<WeatherBundle | null>(null);
  const [flights, setFlights] = useState<TripFlight[]>([]);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [tips, setTips] = useState<AssistantTip[]>([]);
  const [loadingWidgets, setLoadingWidgets] = useState(true);

  // Add flight sheet
  const [flightSheet, setFlightSheet] = useState(false);
  const [flightNum, setFlightNum] = useState('');
  const [flightDate, setFlightDate] = useState(todayIso());
  const [flightDir, setFlightDir] = useState('outbound');
  const [flightDep, setFlightDep] = useState('');
  const [flightArr, setFlightArr] = useState('');
  const [savingFlight, setSavingFlight] = useState(false);
  const [flightError, setFlightError] = useState('');
  const [flightWarning, setFlightWarning] = useState('');

  useEffect(() => {
    if (id) loadTrip(id);
  }, [id]);

  useEffect(() => {
    if (id && currentTrip) setActiveTrip(id, currentTrip.name);
  }, [id, currentTrip?.name]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadingWidgets(true);
    const today = todayIso();

    Promise.allSettled([
      apiClient.get(`/api/planner/${id}`),
      apiClient.get(`/api/decisions/${id}`),
      apiClient.get(`/api/expenses/${id}`),
      apiClient.get(`/api/timeline/${id}?limit=5`),
      apiClient.get(`/api/weather/${id}`),
      apiClient.get(`/api/flights/${id}`),
      apiClient.get(`/api/assistant/${id}`),
    ]).then((results) => {
      if (cancelled) return;
      const [plannerRes, decisionsRes, expensesRes, timelineRes, weatherRes, flightsRes, assistantRes] =
        results;

      if (plannerRes.status === 'fulfilled') {
        setEvents(plannerRes.value.data.events ?? []);
      }
      if (decisionsRes.status === 'fulfilled') {
        const list = decisionsRes.value.data ?? [];
        setOpenDecisions(list.filter((d: { status: string }) => d.status === 'VOTING').length);
      }
      if (expensesRes.status === 'fulfilled') {
        const exps = expensesRes.value.data.expenses ?? [];
        const total = exps.reduce((s: number, e: { amountILS: number }) => s + (e.amountILS || 0), 0);
        const todaySum = exps
          .filter((e: { expenseDate?: string }) => e.expenseDate?.slice(0, 10) === today)
          .reduce((s: number, e: { amountILS: number }) => s + (e.amountILS || 0), 0);
        setExpenseTotal(total);
        setTodaySpend(todaySum);
        setSettlements(expensesRes.value.data.settlements ?? []);
      }
      if (timelineRes.status === 'fulfilled') {
        setTimelinePreview(timelineRes.value.data.events ?? []);
      }
      if (weatherRes.status === 'fulfilled') {
        setWeather(weatherRes.value.data.weather ?? null);
      }
      if (flightsRes.status === 'fulfilled') {
        setFlights(flightsRes.value.data.flights ?? []);
        setLiveEnabled(Boolean(flightsRes.value.data.liveEnabled));
      }
      if (assistantRes.status === 'fulfilled') {
        setTips(assistantRes.value.data.tips ?? []);
      }
    }).finally(() => {
      if (!cancelled) setLoadingWidgets(false);
    });

    // Prefetch for offline
    prefetchTripOffline(id);

    // Soft AI/rule-based smart notifications (deduped server-side).
    // Guard against React StrictMode double-mount firing two concurrent creates.
    const smartTimer = window.setTimeout(() => {
      if (cancelled) return;
      apiClient.post(`/api/notifications/smart/${id}`).catch(() => {});
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(smartTimer);
    };
  }, [id]);

  const todayEvents = useMemo(() => {
    const today = todayIso();
    return [...events]
      .filter((e) => e.date === today)
      .sort((a, b) => (a.allDay ? -1 : a.startMinute) - (b.allDay ? -1 : b.startMinute));
  }, [events]);

  const nextFlight = useMemo(() => {
    const withTime = flights
      .filter((f) => f.minutesUntilDeparture != null)
      .sort((a, b) => (a.minutesUntilDeparture ?? 0) - (b.minutesUntilDeparture ?? 0));
    return withTime.find((f) => (f.minutesUntilDeparture ?? 0) > -60) || flights[0] || null;
  }, [flights]);

  const addFlight = async () => {
    if (!id || !flightNum.trim()) {
      setFlightError('מספר טיסה חובה');
      return;
    }
    setSavingFlight(true);
    setFlightError('');
    setFlightWarning('');
    try {
      const { data } = await apiClient.post(`/api/flights/${id}`, {
        flightNumber: flightNum.trim(),
        flightDate: flightDate || null,
        direction: flightDir,
        departureAirport: flightDep.trim() || null,
        arrivalAirport: flightArr.trim() || null,
      });
      setFlights((prev) => [...prev, data.flight]);
      if (data.warning) setFlightWarning(data.warning);
      setFlightSheet(false);
      setFlightNum('');
      setFlightDep('');
      setFlightArr('');
    } catch (e: any) {
      setFlightError(e?.response?.data?.error || 'שגיאה');
    } finally {
      setSavingFlight(false);
    }
  };

  const refreshFlight = async (flightId: string) => {
    try {
      const { data } = await apiClient.post(`/api/flights/item/${flightId}/refresh`);
      setFlights((prev) => prev.map((f) => (f.id === flightId ? data.flight : f)));
      setFlightWarning('');
    } catch (e: any) {
      setFlightWarning(e?.response?.data?.error || 'לא הצלחנו לרענן');
    }
  };

  const deleteFlight = async (flightId: string) => {
    if (!confirm('למחוק טיסה זו?')) return;
    try {
      await apiClient.delete(`/api/flights/item/${flightId}`);
      setFlights((prev) => prev.filter((f) => f.id !== flightId));
    } catch {
      /* ignore */
    }
  };

  if (isLoading || !currentTrip) {
    return (
      <AppShell showBottomNav>
        <div className="text-center py-12 text-neutral-400">טוען...</div>
      </AppShell>
    );
  }

  const dayLabel = tripDayIndex(currentTrip.startDate, currentTrip.endDate);

  const tipBorder = (s: AssistantTip['severity']) =>
    s === 'urgent'
      ? 'border-red-200 bg-red-50/50'
      : s === 'warn'
        ? 'border-amber-200 bg-amber-50/40'
        : 'border-brand-100 bg-brand-50/30';

  return (
    <AppShell showBottomNav>
      {/* Header */}
      <div className="mb-5">
        <p className="text-xs font-medium text-brand-500 mb-1">
          {STATUS_LABEL[currentTrip.status] ?? currentTrip.status}
          {dayLabel ? ` · ${dayLabel}` : ''}
        </p>
        <h1 className="text-2xl font-bold text-neutral-900 leading-tight">{currentTrip.name}</h1>
        {currentTrip.startDate && (
          <p className="text-sm text-neutral-500 mt-1">
            {new Date(currentTrip.startDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
            {currentTrip.endDate && (
              <> — {new Date(currentTrip.endDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}</>
            )}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {/* Assistant */}
        {tips.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-bold text-neutral-400 px-1">💡 עוזר הטיול</h2>
            {tips.slice(0, 4).map((tip) => (
              <Card
                key={tip.id}
                className={`p-3.5 border ${tipBorder(tip.severity)} ${tip.action ? 'cursor-pointer active:opacity-90' : ''}`}
                onClick={() => tip.action && navigate(tip.action.path)}
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-xl">{tip.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{tip.title}</p>
                    <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{tip.body}</p>
                    {tip.action && (
                      <span className="text-xs text-brand-500 font-medium mt-1 inline-block">
                        {tip.action.label} ←
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Weather */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-neutral-800">🌤️ מזג אוויר</h2>
            {weather?.locationLabel && (
              <span className="text-xs text-neutral-400 truncate max-w-[50%]">{weather.locationLabel}</span>
            )}
          </div>
          {loadingWidgets && !weather ? (
            <p className="text-sm text-neutral-400">טוען...</p>
          ) : !weather?.today ? (
            <p className="text-sm text-neutral-400">
              הוסיפו מקום במפה כדי לקבל תחזית מדויקת ליעד
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-400 mb-1">היום</p>
                <p className="text-2xl leading-none mb-1">{weather.today.emoji}</p>
                <p className="text-sm font-bold text-neutral-900">
                  {weather.today.tempMax}° / {weather.today.tempMin}°
                </p>
                <p className="text-xs text-neutral-500">{weather.today.label}</p>
                {weather.today.precipitationProbability != null && (
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    גשם {weather.today.precipitationProbability}%
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-400 mb-1">מחר</p>
                {weather.tomorrow ? (
                  <>
                    <p className="text-2xl leading-none mb-1">{weather.tomorrow.emoji}</p>
                    <p className="text-sm font-bold text-neutral-900">
                      {weather.tomorrow.tempMax}° / {weather.tomorrow.tempMin}°
                    </p>
                    <p className="text-xs text-neutral-500">{weather.tomorrow.label}</p>
                    {weather.tomorrow.precipitationProbability != null && (
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        גשם {weather.tomorrow.precipitationProbability}%
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-neutral-400">—</p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Flights */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-neutral-800">✈️ טיסות</h2>
            <button
              onClick={() => setFlightSheet(true)}
              className="text-xs font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-lg"
            >
              + טיסה
            </button>
          </div>
          {flightWarning && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2">{flightWarning}</p>
          )}
          {flights.length === 0 ? (
            <p className="text-sm text-neutral-400">
              הוסיפו מספר טיסה אמיתי (למשל LY315) — נמשוך מוצא/יעד וסטטוס
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {flights.map((f) => {
                const live = f.liveData;
                const status = f.statusLabel || live?.statusLabel || live?.status;
                const statusNote = f.statusNote || live?.statusNote;
                const dateOk = f.dateMatched !== false && live?.dateMatched !== false;
                const gate = dateOk ? live?.departure?.gate : null;
                const terminal = dateOk ? live?.departure?.terminal : null;
                const board = dateOk ? boardingLabel(f.minutesUntilDeparture) : null;
                const dateStr = f.flightDate
                  ? new Date(f.flightDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
                  : null;
                const route =
                  f.departureAirport && f.arrivalAirport
                    ? `${f.departureAirport} → ${f.arrivalAirport}`
                    : f.departureAirport
                      ? `${f.departureAirport} → …`
                      : f.arrivalAirport
                        ? `… → ${f.arrivalAirport}`
                        : 'מוצא/יעד לא זמינים — לחצו רענן או מלאו ידנית';
                return (
                  <li
                    key={f.id}
                    className="rounded-xl border border-neutral-100 bg-neutral-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-neutral-900">
                          {f.flightNumber}
                          {f.airline ? ` · ${f.airline}` : ''}
                          {dateStr ? ` · ${dateStr}` : ''}
                        </p>
                        <p className={`text-xs mt-0.5 ${f.departureAirport && f.arrivalAirport ? 'text-neutral-600' : 'text-amber-700'}`}>
                          {route}
                        </p>
                        {status && (
                          <p className={`text-xs font-medium mt-1 ${dateOk ? 'text-brand-600' : 'text-neutral-600'}`}>
                            {status}
                          </p>
                        )}
                        {statusNote && (
                          <p className="text-[11px] text-amber-700 mt-0.5 leading-snug">{statusNote}</p>
                        )}
                        {(gate || terminal) && (
                          <p className="text-[11px] text-neutral-400 mt-0.5">
                            {terminal ? `טרמינל ${terminal}` : ''}
                            {terminal && gate ? ' · ' : ''}
                            {gate ? `שער ${gate}` : ''}
                          </p>
                        )}
                        {board && (
                          <p className="text-xs font-semibold text-amber-700 mt-1">{board}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {liveEnabled && (
                          <button
                            onClick={() => refreshFlight(f.id)}
                            className="text-[11px] text-brand-500 font-medium"
                          >
                            רענן
                          </button>
                        )}
                        <button
                          onClick={() => deleteFlight(f.id)}
                          className="text-[11px] text-red-400 font-medium"
                        >
                          מחק
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {nextFlight && nextFlight.minutesUntilDeparture != null && nextFlight.minutesUntilDeparture > 0 && nextFlight.minutesUntilDeparture <= 180 && (
            <p className="text-xs font-bold text-amber-700 mt-3 bg-amber-50 rounded-lg px-3 py-2">
              ✈️ {nextFlight.flightNumber}: {boardingLabel(nextFlight.minutesUntilDeparture)}
            </p>
          )}
        </Card>

        {/* Today's schedule */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-neutral-800">📅 היום בלוח</h2>
            <button
              onClick={() => id && navigate(planSubPath(id, 'schedule'))}
              className="text-xs text-brand-500 font-medium"
            >
              לוח מלא ←
            </button>
          </div>
          {loadingWidgets && events.length === 0 ? (
            <p className="text-sm text-neutral-400">טוען...</p>
          ) : todayEvents.length === 0 ? (
            <p className="text-sm text-neutral-400">אין אירועים להיום</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {todayEvents.slice(0, 5).map((ev) => (
                <li key={ev.id} className="flex items-center gap-2 text-sm">
                  <span className="text-neutral-400 tabular-nums w-12 flex-shrink-0">
                    {ev.allDay ? 'יום' : fmtMin(ev.startMinute)}
                  </span>
                  <span className="font-medium text-neutral-800 truncate">{ev.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Expenses */}
        <Card
          className="p-4 cursor-pointer active:bg-neutral-50"
          onClick={() => id && navigate(`/trip/${id}/expenses`)}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-neutral-800">💶 הוצאות</h2>
            <span className="text-xs text-brand-500 font-medium">פרטים ←</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-neutral-400">היום</p>
              <p className="text-lg font-bold text-neutral-900">{fmtILS(todaySpend)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">סה״כ טיול</p>
              <p className="text-lg font-bold text-neutral-900">{fmtILS(expenseTotal)}</p>
            </div>
          </div>
        </Card>

        {/* Balance */}
        <Card
          className="p-4 cursor-pointer active:bg-neutral-50"
          onClick={() => id && navigate(`/trip/${id}/expenses`)}
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-neutral-800">⚖️ יתרות</h2>
            <span className="text-xs text-brand-500 font-medium">סילוקין ←</span>
          </div>
          {settlements.length === 0 ? (
            <p className="text-sm text-neutral-400">הכל מאוזן 🎉</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {settlements.slice(0, 3).map((s, i) => (
                <li key={i} className="text-sm text-neutral-700 flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <span className="text-brand-600">{s.from.name}</span>
                    <span className="text-neutral-400 font-bold" aria-hidden>←</span>
                    <span>{s.to.name}</span>
                  </span>
                  <span className="text-neutral-500">· {fmtILS(s.amountILS)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Decisions */}
        <Card
          className="p-4 cursor-pointer active:bg-neutral-50"
          onClick={() => id && navigate(planSubPath(id, 'decisions'))}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-neutral-800 mb-1">✅ החלטות</h2>
              <p className="text-sm text-neutral-500">
                {openDecisions === 0
                  ? 'אין החלטות פתוחות'
                  : openDecisions === 1
                    ? 'החלטה אחת בהצבעה'
                    : `${openDecisions} החלטות בהצבעה`}
              </p>
            </div>
            <span className="text-xs text-brand-500 font-medium">פתח ←</span>
          </div>
        </Card>

        {/* Timeline */}
        <Card
          className="p-4 cursor-pointer active:bg-neutral-50"
          onClick={() => id && navigate(`/trip/${id}/timeline`)}
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-neutral-800">📖 ציר זמן</h2>
            <span className="text-xs text-brand-500 font-medium">הכל ←</span>
          </div>
          {timelinePreview.length === 0 ? (
            <p className="text-sm text-neutral-400">עדיין אין אירועים</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {timelinePreview.slice(0, 4).map((ev) => (
                <li key={ev.id} className="flex items-start gap-2 text-sm">
                  <span className="flex-shrink-0">{ev.emoji}</span>
                  <span className="text-neutral-700 truncate flex-1">{ev.title}</span>
                  <span className="text-[11px] text-neutral-400 flex-shrink-0 tabular-nums">
                    {new Date(ev.occurredAt).toLocaleTimeString('he-IL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Flight sheet */}
      {flightSheet && (
        <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => !savingFlight && setFlightSheet(false)} />
          <div className="relative bg-white rounded-t-3xl p-5 pb-10 shadow-2xl">
            <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-4">✈️ הוספת טיסה</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-600 mb-1 block">מספר טיסה</label>
                <input
                  value={flightNum}
                  onChange={(e) => setFlightNum(e.target.value.toUpperCase())}
                  placeholder="LY347"
                  className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-600 mb-1 block">תאריך</label>
                <input
                  type="date"
                  value={flightDate}
                  onChange={(e) => setFlightDate(e.target.value)}
                  className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-neutral-600 mb-1 block">מוצא (אופציונלי)</label>
                  <input
                    value={flightDep}
                    onChange={(e) => setFlightDep(e.target.value.toUpperCase())}
                    placeholder="TLV"
                    className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-600 mb-1 block">יעד (אופציונלי)</label>
                  <input
                    value={flightArr}
                    onChange={(e) => setFlightArr(e.target.value.toUpperCase())}
                    placeholder="MUC"
                    className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
              <p className="text-[11px] text-neutral-400">
                אם החיפוש החי לא מוצא את הטיסה (מספר שגוי / תאריך רחוק) — מלאו מוצא ויעד ידנית.
              </p>
              <div className="flex gap-2">
                {[
                  { id: 'outbound', label: 'הלוך' },
                  { id: 'return', label: 'חזור' },
                  { id: 'other', label: 'אחר' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setFlightDir(d.id)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                      flightDir === d.id
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-neutral-200 text-neutral-600'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {flightError && <p className="text-sm text-red-500 text-center">{flightError}</p>}
              <button
                onClick={addFlight}
                disabled={savingFlight || !flightNum.trim()}
                className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-2xl disabled:opacity-50"
              >
                {savingFlight ? 'מחפש ושומר...' : 'הוסף טיסה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
