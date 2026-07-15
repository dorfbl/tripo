import { prisma } from '../lib/prisma';
import { fetchWeatherForecast } from './weather.service';
import { minutesUntil } from './flights.service';

export interface AssistantTip {
  id: string;
  severity: 'info' | 'warn' | 'urgent';
  emoji: string;
  title: string;
  body: string;
  action?: { label: string; path: string };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function buildAssistantTips(tripId: string): Promise<AssistantTip[]> {
  const tips: AssistantTip[] = [];

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      places: { orderBy: { createdAt: 'asc' }, take: 30 },
      decisions: { include: { votes: true } },
      expenses: { orderBy: { expenseDate: 'desc' }, take: 20 },
      links: { where: { type: 'FLIGHT' }, take: 10 },
      flights: true,
      plannerEvents: true,
      plannerActivities: { include: { votes: true } },
    },
  });
  if (!trip) return tips;

  const memberCount = trip.members.length;
  const today = todayKey();

  // ── Open decisions ──
  const openDecisions = trip.decisions.filter((d) => d.status === 'VOTING');
  if (openDecisions.length > 0) {
    const withoutVotes = openDecisions.filter((d) => {
      const voters = new Set(d.votes.map((v) => v.userId));
      return voters.size < memberCount;
    });
    tips.push({
      id: 'open-decisions',
      severity: openDecisions.length >= 3 ? 'warn' : 'info',
      emoji: '✅',
      title:
        openDecisions.length === 1
          ? 'החלטה אחת עדיין פתוחה'
          : `${openDecisions.length} החלטות בהצבעה`,
      body:
        withoutVotes.length > 0
          ? 'יש חברים שעדיין לא הצביעו — כדאי לסגור לפני היציאה.'
          : 'כולם הצביעו — אפשר לסגור את ההחלטות.',
      action: { label: 'להחלטות', path: `/trip/${tripId}/plan/decisions` },
    });
  }

  // ── Activity votes incomplete ──
  if (trip.plannerActivities.length > 0) {
    const incomplete = trip.plannerActivities.filter(
      (a) => a.votes.length < memberCount,
    ).length;
    if (incomplete > 3) {
      tips.push({
        id: 'activity-votes',
        severity: 'info',
        emoji: '🗳️',
        title: 'יש פעילויות בלי הצבעות מלאות',
        body: `${incomplete} פעילויות ממתינות להצבעת כולם.`,
        action: { label: 'להצבעה', path: `/trip/${tripId}/plan/activities` },
      });
    }
  }

  // ── Today's schedule ──
  const todayEvents = trip.plannerEvents
    .filter((e) => e.date === today)
    .sort((a, b) => a.startMinute - b.startMinute);
  if (todayEvents.length > 0) {
    const next = todayEvents[0];
    const h = Math.floor(next.startMinute / 60);
    const m = next.startMinute % 60;
    tips.push({
      id: 'today-schedule',
      severity: 'info',
      emoji: '📅',
      title: `היום: ${todayEvents.length} אירועים בלוח`,
      body: next.allDay
        ? `כולל: ${next.title} (כל היום)`
        : `הבא: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${next.title}`,
      action: { label: 'לוח זמנים', path: `/trip/${tripId}/plan/schedule` },
    });
  } else if (trip.status === 'LIVE') {
    tips.push({
      id: 'empty-today',
      severity: 'info',
      emoji: '🗓️',
      title: 'אין אירועים בלוח להיום',
      body: 'אפשר להוסיף פעילויות בלוח הזמנים כדי שהקבוצה תהיה מתואמת.',
      action: { label: 'תכנון', path: `/trip/${tripId}/plan/schedule` },
    });
  }

  // ── Weather rain tomorrow ──
  try {
    const placesWithCoords = trip.places.filter((p) => p.lat != null && p.lng != null);
    const place =
      placesWithCoords.find((p) => p.category === 'hotel') || placesWithCoords[0];
    if (place) {
      const weather = await fetchWeatherForecast(
        place.lat,
        place.lng,
        trip.startDate?.toISOString().slice(0, 10),
        trip.endDate?.toISOString().slice(0, 10),
        place.name,
      );
      if (
        weather.tomorrow &&
        (weather.tomorrow.precipitationProbability ?? 0) >= 50
      ) {
        tips.push({
          id: 'rain-tomorrow',
          severity: 'warn',
          emoji: '🌧️',
          title: `מחר צפוי גשם (${weather.tomorrow.precipitationProbability}%)`,
          body: `ב${weather.locationLabel}: ${weather.tomorrow.label}, ${weather.tomorrow.tempMin}°–${weather.tomorrow.tempMax}°. שקלו לדחות טיול ביער/חוץ.`,
          action: { label: 'לוח זמנים', path: `/trip/${tripId}/plan/schedule` },
        });
      } else if (weather.today) {
        tips.push({
          id: 'weather-today',
          severity: 'info',
          emoji: weather.today.emoji,
          title: `היום ${weather.today.label} · ${weather.today.tempMax}°`,
          body: `ב${weather.locationLabel}: ${weather.today.tempMin}°–${weather.today.tempMax}°.`,
        });
      }
    }
  } catch {
    /* weather optional */
  }

  // ── Flights boarding soon ──
  for (const fl of trip.flights) {
    const live = fl.liveData as any;
    const depIso =
      fl.departureAt?.toISOString() ||
      live?.departure?.estimated ||
      live?.departure?.scheduled ||
      null;
    const mins = minutesUntil(depIso);
    if (mins != null && mins > 0 && mins <= 180) {
      tips.push({
        id: `flight-${fl.id}`,
        severity: mins <= 60 ? 'urgent' : 'warn',
        emoji: '✈️',
        title:
          mins <= 60
            ? `עלייה למטוס בקרוב · ${fl.flightNumber}`
            : `טיסה בעוד ${mins} דק׳ · ${fl.flightNumber}`,
        body: fl.departureAirport
          ? `יציאה מ-${fl.departureAirport}`
          : 'בדקו שער וטרמינל באפליקציית חברת התעופה.',
        action: { label: 'טיסות', path: `/trip/${tripId}/home` },
      });
    }
  }

  // ── Expenses today missing while LIVE ──
  if (trip.status === 'LIVE') {
    const todaySpend = trip.expenses.filter(
      (e) => e.expenseDate.toISOString().slice(0, 10) === today,
    );
    if (todaySpend.length === 0) {
      tips.push({
        id: 'no-expense-today',
        severity: 'info',
        emoji: '💶',
        title: 'עדיין לא נרשמו הוצאות היום',
        body: 'אם שילמתם על אוכל/נסיעות — שווה לרשום עכשיו כדי לא לשכוח.',
        action: { label: 'הוצאות', path: `/trip/${tripId}/expenses` },
      });
    }
  }

  // ── Trip countdown ──
  if (trip.startDate && trip.status === 'PLAN') {
    const start = new Date(trip.startDate.toISOString().slice(0, 10) + 'T12:00:00');
    const now = new Date(today + 'T12:00:00');
    const days = Math.round((start.getTime() - now.getTime()) / 86400000);
    if (days > 0 && days <= 14) {
      tips.push({
        id: 'countdown',
        severity: days <= 3 ? 'warn' : 'info',
        emoji: '🧳',
        title: days === 1 ? 'מחר יוצאים!' : `עוד ${days} ימים ליציאה`,
        body: 'בדקו קישורים, הזמנות והחלטות פתוחות לפני שאתם בדרך.',
        action: { label: 'קישורים', path: `/trip/${tripId}/links` },
      });
    }
  }

  // ── Missing links while PLAN ──
  if (trip.status === 'PLAN') {
    const hasFlightLink =
      trip.links.some((l) => l.type === 'FLIGHT') || trip.flights.length > 0;
    const hasHotel = trip.links.some((l) => l.type === 'HOTEL');
    if (!hasFlightLink) {
      tips.push({
        id: 'missing-flight-link',
        severity: 'info',
        emoji: '✈️',
        title: 'אין עדיין טיסה שמורה',
        body: 'הוסיפו קישור הזמנה או מספר טיסה כדי שהקבוצה תמצא מהר.',
        action: { label: 'קישורים', path: `/trip/${tripId}/links` },
      });
    }
    if (!hasHotel) {
      tips.push({
        id: 'missing-hotel',
        severity: 'info',
        emoji: '🏨',
        title: 'אין עדיין מלון בקישורים',
        body: 'שמרו את אישור ההזמנה תחת קישורים.',
        action: { label: 'קישורים', path: `/trip/${tripId}/links` },
      });
    }
  }

  // ── Timed schedule overlaps ONLY ──
  // All-day items (hotel, travel day, …) never overlap with anything.
  {
    const isAllDayEvent = (e: {
      allDay?: boolean | null;
      durationMins?: number | null;
      startMinute?: number | null;
      title?: string | null;
    }) => {
      if (e.allDay) return true;
      const dur = e.durationMins ?? 0;
      // Full calendar day blocks
      if (dur >= 24 * 60) return true;
      // Common lodging labels that are "background" for the day
      const t = (e.title || '').toLowerCase();
      if (
        /(^|\s)(מלון|hotel|motel|hostel|לינה|אכסניה|apartment|airbnb)(\s|$)/i.test(t)
      ) {
        // hotel-like title spanning most of the day
        if (dur >= 8 * 60 || (e.startMinute === 0 && dur >= 6 * 60)) return true;
      }
      return false;
    };

    const timed = trip.plannerEvents.filter((e) => !isAllDayEvent(e));
    const byDate = new Map<string, typeof timed>();
    for (const ev of timed) {
      const list = byDate.get(ev.date) || [];
      list.push(ev);
      byDate.set(ev.date, list);
    }
    const pairs: string[] = [];
    for (const [date, list] of byDate) {
      const sorted = [...list].sort((a, b) => a.startMinute - b.startMinute);
      for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i];
        const aEnd = a.startMinute + Math.max(15, a.durationMins || 60);
        for (let j = i + 1; j < sorted.length; j++) {
          const b = sorted[j];
          if (b.startMinute >= aEnd) break; // sorted — no more overlaps with a
          const bEnd = b.startMinute + Math.max(15, b.durationMins || 60);
          // true interval overlap (not merely same calendar day)
          if (a.startMinute < bEnd && b.startMinute < aEnd) {
            const fmt2 = (m: number) => {
              const x = ((m % 1440) + 1440) % 1440;
              return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
            };
            pairs.push(
              `${a.title} (${fmt2(a.startMinute)}–${fmt2(aEnd)}) ↔ ${b.title} (${fmt2(b.startMinute)}–${fmt2(bEnd)}) · ${date}`,
            );
          }
        }
      }
    }
    if (pairs.length === 1) {
      tips.push({
        id: 'schedule-overlap',
        severity: 'warn',
        emoji: '⏱️',
        title: 'חפיפת זמנים בלוח',
        body: pairs[0] + ' (אירועי יום־שלם/מלון לא נספרים)',
        action: { label: 'לוח זמנים', path: `/trip/${tripId}/plan/schedule` },
      });
    } else if (pairs.length > 1) {
      tips.push({
        id: 'schedule-overlaps',
        severity: 'warn',
        emoji: '⏱️',
        title: `${pairs.length} חפיפות זמנים בלוח`,
        body:
          pairs.slice(0, 3).join(' · ') +
          (pairs.length > 3 ? '…' : '') +
          ' (אירועי יום־שלם/מלון לא נספרים)',
        action: { label: 'לוח זמנים', path: `/trip/${tripId}/plan/schedule` },
      });
    }
  }

  // ── Opening hours conflicts (timed events only — never all-day) ──
  try {
    const { checkEventOpeningHours } = await import('./openingHours.service');
    const upcoming = trip.plannerEvents
      .filter((e) => e.date >= today && !e.allDay)
      .slice(0, 12);
    const conflicts: string[] = [];
    for (const ev of upcoming) {
      const act = trip.plannerActivities.find((a) => a.id === ev.activityId);
      const warnings = await checkEventOpeningHours({
        title: ev.title,
        date: ev.date,
        startMinute: ev.startMinute,
        durationMins: ev.durationMins,
        allDay: false,
        category: act?.category,
        mapsUrl: ev.mapsUrl || act?.mapsUrl,
        location: act?.location,
        name: act?.name || ev.title,
      });
      // Only flag conflicts from Google data (source='google'), not heuristics
      // Heuristics are too conservative and create false positives
      const googleCritical = warnings.some(
        (w) => w.severity === 'critical' && w.source === 'google'
      );
      if (googleCritical) {
        conflicts.push(ev.title);
      }
    }
    if (conflicts.length === 1) {
      tips.push({
        id: 'hours-conflict',
        severity: 'urgent',
        emoji: '🚫',
        title: `ייתכן שסגור בשעה ששיבצתם · ${conflicts[0]}`,
        body: 'לא חפיפה בלוח — אלא שהמקום עצמו כנראה סגור בזמן שנבחר. בדקו שעות פתיחה או הזיזו את האירוע.',
        action: { label: 'לוח זמנים', path: `/trip/${tripId}/plan/schedule` },
      });
    } else if (conflicts.length > 1) {
      tips.push({
        id: 'hours-conflicts',
        severity: 'urgent',
        emoji: '🚫',
        title: `${conflicts.length} מקומות כנראה סגורים בשעה ששיבצתם`,
        body:
          conflicts.slice(0, 3).join(' · ') +
          (conflicts.length > 3 ? '…' : '') +
          ' — כל אחד בנפרד (לא בהכרח חופפים זה לזה).',
        action: { label: 'לוח זמנים', path: `/trip/${tripId}/plan/schedule` },
      });
    }
  } catch {
    /* optional */
  }

  // Sort: urgent > warn > info, cap at 6
  const rank = { urgent: 0, warn: 1, info: 2 };
  tips.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return tips.slice(0, 6);
}
