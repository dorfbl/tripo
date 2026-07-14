/**
 * Detect when a planner event is scheduled while the place is likely closed.
 * Sources:
 *  1) Google Places opening_hours (when GOOGLE_MAPS_KEY works)
 *  2) Category / name heuristics (always available)
 */

import { config } from '../config/env';

export type ScheduleWarningSeverity = 'warn' | 'critical';

export interface ScheduleWarning {
  severity: ScheduleWarningSeverity;
  code: string;
  message: string;
  /** Hebrew weekday label of the scheduled day */
  dayLabel?: string;
  /** Human summary of known hours */
  hoursSummary?: string;
  source: 'google' | 'heuristic';
}

export interface ScheduleCheckInput {
  title: string;
  date: string; // YYYY-MM-DD
  startMinute: number;
  durationMins: number;
  allDay?: boolean;
  category?: string | null;
  mapsUrl?: string | null;
  location?: string | null;
  name?: string | null;
  openingHours?: any; // From Place.openingHours (database)
}

interface DayPeriod {
  /** minutes from midnight, may exceed 1440 if spans past midnight */
  openMin: number;
  closeMin: number;
}

interface ResolvedHours {
  source: 'google';
  placeName?: string;
  /** 0=Sunday … 6=Saturday → periods that day */
  byDay: Record<number, DayPeriod[]>;
  /** closed all day if key missing or empty array and we know hours */
  weekdayText?: string[];
  alwaysOpen?: boolean;
}

const DAY_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const hoursCache = new Map<string, { at: number; hours: ResolvedHours | null }>();
const CACHE_MS = 6 * 60 * 60 * 1000;

function dayOfWeek(dateIso: string): number {
  // Local-noon avoids DST edge; weekday is what users mean
  return new Date(dateIso + 'T12:00:00').getDay(); // 0 Sun
}

function fmtMin(m: number): string {
  const wrapped = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function parseHmm(t: string | undefined): number | null {
  if (!t || !/^\d{3,4}$/.test(t)) return null;
  const s = t.padStart(4, '0');
  const h = parseInt(s.slice(0, 2), 10);
  const m = parseInt(s.slice(2), 10);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function isFoodCategory(category?: string | null, title?: string): boolean {
  const c = (category || '').toLowerCase();
  if (c === 'food' || c === 'restaurant' || c === 'bar' || c === 'orange') return true;
  const t = (title || '').toLowerCase();
  return /restaurant|מסעד|בירה|brau|hofbräu|hofbrau|café|cafe|bar |beer|אוכל|אכל|wirtshaus|gasthof|bräu|brauerei|taverne|trattoria|pizzeria|steak|sushi|dinner|ארוח/.test(
    t,
  );
}

/** Flights / transfers / lodging — not "places" with opening hours */
function isNonPlaceScheduleItem(title?: string | null, category?: string | null): boolean {
  const t = (title || '').toLowerCase().trim();
  const c = (category || '').toLowerCase();
  if (c === 'travel' && /טיסה|flight|transfer|העברה|רכבת|train|bus|אוטובוס/.test(t)) return true;
  return /^(טיסה|flight|flights?|המראה|נחיתה|check[\s-]?in|צ.?ק.?אין|transfer|העברה|רכבת|train|bus|אוטובוס|taxi|מונית|נסיעה|drive|שכירת רכב|car rental)(\s|$|–|-)/i.test(
    t,
  ) || /טיסה\s|flight\s|airport|שדה תעופה|נתב.?ג/.test(t);
}

/** Evening is normal: escape rooms, bars, shows, nightlife */
function isEveningOkActivity(title?: string | null, category?: string | null): boolean {
  const t = (title || '').toLowerCase();
  if (isFoodCategory(category, title || undefined)) return true;
  return /escape|בריחה|exit the room|bar|club|nightlife|קונצרט|concert|show|מופע|theatre|theater|cinema|קולנוע|halloween|traumatica|party|מסיב|ביר.?ה|brau|pub|karaoke/.test(
    t,
  );
}

function isAttractionCategory(category?: string | null, title?: string): boolean {
  if (isNonPlaceScheduleItem(title, category)) return false;
  if (isEveningOkActivity(title, category) && !isFoodCategory(category, title || undefined)) {
    // escape rooms etc. are not "museums closed at 18:00"
    return false;
  }
  const c = (category || '').toLowerCase();
  if (['munich', 'forest', 'special', 'culture', 'activity', 'nature', 'travel'].includes(c)) {
    // food-like titles override
    if (isFoodCategory(category, title)) return false;
    return true;
  }
  const t = (title || '').toLowerCase();
  return /museum|מוזיא|palace|castle|טיר|ארמון|park|פארק|cathedral|קתדר|gallery|גלרי|zoo|גן חיות|residenz|pinakothek|schloss|burg |dome|basilica/.test(
    t,
  );
}

function isShopLike(title?: string): boolean {
  const t = (title || '').toLowerCase();
  return /shop|market|markt|שוק|mall|חנות|kaufen|store/.test(t);
}

/** Single line says open 24 hours (EN/HE + variants) */
function is24hTextLine(line?: string | null): boolean {
  if (!line) return false;
  return /24\s*h(ours?)?|open\s*24|24\/7|פתוח(?:ה|ים)?\s*24|24\s*שעות|around\s*the\s*clock|always\s*open|מסביב\s*לשעון|open\s*all\s*day/i.test(
    line,
  );
}

/** True if weekday_text clearly says 24 hours most/all days */
function weekdayTextAlwaysOpen(weekdayText?: string[]): boolean {
  if (!weekdayText?.length) return false;
  const hits = weekdayText.filter((t) => is24hTextLine(t)).length;
  // majority of listed days (handles 5–7 day lists)
  return hits > 0 && hits >= Math.min(5, weekdayText.length);
}

/**
 * Map JS getDay() (0=Sun) → index in Google weekday_text.
 * EN API: Mon…Sun. HE API often: ראשון…שבת (Sun…Sat).
 */
function weekdayTextForJsDow(weekdayText: string[] | undefined, jsDow: number): string | undefined {
  if (!weekdayText?.length) return undefined;
  const first = (weekdayText[0] || '').toLowerCase();
  const startsSunday =
    /ראשון|sunday/i.test(first) ||
    // HE lists often "יום ראשון: …"
    first.includes('יום ראשון');
  if (startsSunday) {
    return weekdayText[jsDow];
  }
  // Default English / standard Places: Monday = index 0
  const googleIdx = jsDow === 0 ? 6 : jsDow - 1;
  return weekdayText[googleIdx] ?? weekdayText[jsDow];
}

function dayCoverageMinutes(periodsD: DayPeriod[]): number {
  if (!periodsD.length) return 0;
  const sorted = [...periodsD].sort((a, b) => a.openMin - b.openMin);
  let cover = 0;
  let cur = -1;
  for (const p of sorted) {
    const o = Math.max(p.openMin, cur);
    const c = Math.min(p.closeMin, 1440);
    if (c > o) cover += c - o;
    cur = Math.max(cur, p.closeMin);
  }
  return cover;
}

/**
 * Parse database weekday_text array into ResolvedHours format.
 * Handles both standard and condensed Hebrew formats:
 * - Standard: ["Monday: 15:00–2:00", "Tuesday: 10:00–18:00", ...]
 * - Condensed: ["א'-ה': 15:00–2:00 | ו'-שבת: 15:00–3:00"]
 */
function parseWeekdayTextToHours(weekdayText: string[], placeName: string): ResolvedHours {
  const byDay: Record<number, DayPeriod[]> = {};
  for (let d = 0; d < 7; d++) byDay[d] = [];

  // Check if always open
  if (weekdayTextAlwaysOpen(weekdayText)) {
    for (let d = 0; d < 7; d++) {
      byDay[d].push({ openMin: 0, closeMin: 1440 });
    }
    return { source: 'google', byDay, alwaysOpen: true, weekdayText, placeName };
  }

  // Helper to parse Hebrew day abbreviations
  const parseHebrewDayRange = (dayPart: string): number[] => {
    // א'=Sunday(0), ב'=Monday(1), ג'=Tuesday(2), ד'=Wednesday(3), ה'=Thursday(4), ו'=Friday(5), שבת=Saturday(6)
    const dayMap: Record<string, number> = {
      "א'": 0, "ב'": 1, "ג'": 2, "ד'": 3, "ה'": 4, "ו'": 5, "שבת": 6
    };

    // Handle ranges like "א'-ה'" or single days like "שבת"
    if (dayPart.includes('-')) {
      const [start, end] = dayPart.split('-');
      const startDay = dayMap[start.trim()];
      const endDay = dayMap[end.trim()];
      if (startDay !== undefined && endDay !== undefined) {
        const days = [];
        for (let d = startDay; d <= endDay; d++) {
          days.push(d);
        }
        return days;
      }
    } else {
      const day = dayMap[dayPart.trim()];
      if (day !== undefined) return [day];
    }
    return [];
  };

  // Process each line
  for (const line of weekdayText) {
    if (!line) continue;

    // Check for 24h
    if (is24hTextLine(line)) {
      for (let d = 0; d < 7; d++) {
        byDay[d].push({ openMin: 0, closeMin: 1440 });
      }
      continue;
    }

    // Check for condensed Hebrew format: "א'-ה': 15:00–2:00 | ו'-שבת: 15:00–3:00"
    if (line.includes('|')) {
      const segments = line.split('|');
      for (const segment of segments) {
        const match = segment.match(/([א-ת'-]+)\s*:\s*(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
        if (match) {
          const dayPart = match[1];
          const openH = parseInt(match[2], 10);
          const openM = parseInt(match[3], 10);
          const closeH = parseInt(match[4], 10);
          const closeM = parseInt(match[5], 10);

          const days = parseHebrewDayRange(dayPart);
          const openMin = openH * 60 + openM;
          let closeMin = closeH * 60 + closeM;

          // Handle next-day closing (e.g., 15:00–2:00)
          const isNextDay = closeMin < openMin;
          for (let i = 0; i < days.length; i++) {
            const jsDow = days[i];
            byDay[jsDow].push({ openMin, closeMin: isNextDay ? 1440 : closeMin });

            // Add next-day period only if this is the last day in the range or if single day
            if (isNextDay && (i === days.length - 1 || days.length === 1)) {
              const nextDay = (jsDow + 1) % 7;
              byDay[nextDay].push({ openMin: 0, closeMin });
            }
          }
        }
      }
      continue;
    }

    // Standard format: try to get day from weekday_text position
    for (let jsDow = 0; jsDow < 7; jsDow++) {
      const dayLine = weekdayTextForJsDow(weekdayText, jsDow);
      if (dayLine !== line) continue;

      // Check if closed
      if (/closed|סגור/i.test(line)) {
        continue; // leave empty array
      }

      // Parse time ranges: "15:00–2:00" or "10:00–18:00"
      const timeRanges = line.match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/g);
      if (!timeRanges) continue;

      for (const range of timeRanges) {
        const match = range.match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
        if (!match) continue;

        const openH = parseInt(match[1], 10);
        const openM = parseInt(match[2], 10);
        const closeH = parseInt(match[3], 10);
        const closeM = parseInt(match[4], 10);

        const openMin = openH * 60 + openM;
        let closeMin = closeH * 60 + closeM;

        // Handle next-day closing
        if (closeMin < openMin) {
          byDay[jsDow].push({ openMin, closeMin: 1440 });
          const nextDay = (jsDow + 1) % 7;
          byDay[nextDay].push({ openMin: 0, closeMin });
        } else {
          byDay[jsDow].push({ openMin, closeMin });
        }
      }
    }
  }

  return { source: 'google', byDay, weekdayText, placeName };
}

/** Convert Google periods into per-weekday open intervals */
function googlePeriodsToByDay(periods: any[], weekdayText?: string[]): ResolvedHours {
  const byDay: Record<number, DayPeriod[]> = {};
  for (let d = 0; d < 7; d++) byDay[d] = [];

  // Fill from weekday_text "Open 24 hours" first (authoritative when periods are weird)
  if (weekdayText?.length) {
    for (let jsDow = 0; jsDow < 7; jsDow++) {
      const line = weekdayTextForJsDow(weekdayText, jsDow);
      if (is24hTextLine(line)) {
        byDay[jsDow].push({ openMin: 0, closeMin: 1440 });
      }
    }
  }

  // Classic Google "always open": one period, open only, no close
  if (periods.length === 1 && periods[0]?.open && !periods[0]?.close) {
    return { source: 'google', byDay, alwaysOpen: true, weekdayText };
  }

  if (weekdayTextAlwaysOpen(weekdayText)) {
    for (let d = 0; d < 7; d++) {
      if (!byDay[d].length) byDay[d].push({ openMin: 0, closeMin: 1440 });
    }
    return { source: 'google', byDay, alwaysOpen: true, weekdayText };
  }

  // current_opening_hours sometimes returns ONE period spanning the whole week:
  // open Sun 00:00 → close Sat 23:59 (with date fields). Treat as always open.
  if (periods.length === 1 && periods[0]?.open && periods[0]?.close) {
    const od = periods[0].open.day;
    const cd = periods[0].close.day;
    const ot = parseHmm(periods[0].open.time);
    const ct = parseHmm(periods[0].close.time);
    const span = od != null && cd != null ? (cd - od + 7) % 7 : 0;
    if (
      ot === 0 &&
      ct != null &&
      (ct >= 23 * 60 + 30 || ct === 0) &&
      span >= 5
    ) {
      for (let d = 0; d < 7; d++) {
        byDay[d] = [{ openMin: 0, closeMin: 1440 }];
      }
      return { source: 'google', byDay, alwaysOpen: true, weekdayText };
    }
  }

  for (const p of periods) {
    const od = p?.open?.day;
    const ot = parseHmm(p?.open?.time);
    if (od == null || ot == null) continue;
    const cd = p?.close?.day;
    const ct = parseHmm(p?.close?.time);
    if (cd == null || ct == null) {
      // open with no close → treat as open until end of day
      byDay[od].push({ openMin: ot, closeMin: 1440 });
      continue;
    }
    const span = (cd - od + 7) % 7;
    if (span === 0) {
      if (ct > ot) byDay[od].push({ openMin: ot, closeMin: ct });
      else if (ct === 0 && ot === 0) {
        // 00:00–00:00 same day → full day
        byDay[od].push({ openMin: 0, closeMin: 1440 });
      } else if (ct === 0) {
        // open → midnight
        byDay[od].push({ openMin: ot, closeMin: 1440 });
      } else {
        // rare same-day wrap (e.g. 18:00–03:00 written same day)
        byDay[od].push({ openMin: ot, closeMin: 1440 });
        byDay[od].push({ openMin: 0, closeMin: ct });
      }
    } else if (span === 1 && ct === 0 && ot === 0) {
      // e.g. Mon 00:00 → Tue 00:00 = full Monday
      byDay[od].push({ openMin: 0, closeMin: 1440 });
    } else if (span === 1) {
      // overnight into next calendar day
      byDay[od].push({ openMin: ot, closeMin: 1440 + ct });
      if (ct > 0) byDay[cd].push({ openMin: 0, closeMin: ct });
    } else {
      // Multi-day span (e.g. Sun 00:00 → Sat 23:59) — fill every intermediate day
      byDay[od].push({ openMin: ot, closeMin: 1440 });
      for (let i = 1; i < span; i++) {
        const mid = (od + i) % 7;
        byDay[mid].push({ openMin: 0, closeMin: 1440 });
      }
      // close day: open from midnight until close (2359 ≈ end of day)
      const closeEnd = ct >= 23 * 60 + 30 ? 1440 : ct;
      if (closeEnd > 0) byDay[cd].push({ openMin: 0, closeMin: closeEnd });
    }
  }

  // Detect 24h from full coverage on every day
  let fullDays = 0;
  let daysWithData = 0;
  for (let d = 0; d < 7; d++) {
    const periodsD = byDay[d] || [];
    if (!periodsD.length) continue;
    daysWithData += 1;
    if (dayCoverageMinutes(periodsD) >= 1430) fullDays += 1;
  }
  if (fullDays >= 7 || (fullDays >= 6 && daysWithData >= 6)) {
    return { source: 'google', byDay, alwaysOpen: true, weekdayText };
  }

  return { source: 'google', byDay, weekdayText };
}

async function fetchGoogleHours(query: string): Promise<ResolvedHours | null> {
  const key = config.googleMapsKey;
  if (!key || !query.trim()) return null;

  const cacheKey = query.toLowerCase().replace(/\s+/g, ' ').trim();
  const cached = hoursCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.hours;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);

    const findUrl =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
      `?input=${encodeURIComponent(query)}` +
      `&inputtype=textquery` +
      `&fields=place_id,name` +
      `&language=he` +
      `&key=${key}`;
    const fr = await fetch(findUrl, {
      headers: { Referer: 'https://trip.kefar-sava.co.il/' },
      signal: ctrl.signal,
    });
    const fdata: any = await fr.json();
    if (fdata.status && fdata.status !== 'OK' && fdata.status !== 'ZERO_RESULTS') {
      console.warn('[openingHours] findplace status:', fdata.status, fdata.error_message || '');
    }
    const placeId = fdata?.candidates?.[0]?.place_id;
    const placeName = fdata?.candidates?.[0]?.name as string | undefined;
    if (!placeId) {
      clearTimeout(timer);
      hoursCache.set(cacheKey, { at: Date.now(), hours: null });
      return null;
    }

    const detUrl =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=name,opening_hours,current_opening_hours` +
      `&language=he` +
      `&key=${key}`;
    const dr = await fetch(detUrl, {
      headers: { Referer: 'https://trip.kefar-sava.co.il/' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const ddata: any = await dr.json();
    if (ddata.status && ddata.status !== 'OK') {
      console.warn('[openingHours] details status:', ddata.status, ddata.error_message || '');
    }
    const result = ddata?.result;
    // Prefer classic weekly opening_hours; current_opening_hours often uses
    // a single date-spanning period that is easy to mis-parse.
    const classic = result?.opening_hours;
    const current = result?.current_opening_hours;
    const weekdayText = classic?.weekday_text || current?.weekday_text;
    const periods =
      classic?.periods?.length ? classic.periods : current?.periods;
    if (!periods?.length && !weekdayText?.length) {
      hoursCache.set(cacheKey, { at: Date.now(), hours: null });
      return null;
    }
    const resolved = googlePeriodsToByDay(periods || [], weekdayText);
    resolved.placeName = result?.name || placeName;
    resolved.weekdayText = weekdayText || resolved.weekdayText;
    if (!resolved.alwaysOpen && weekdayTextAlwaysOpen(weekdayText)) {
      resolved.alwaysOpen = true;
      for (let d = 0; d < 7; d++) {
        if (!resolved.byDay[d]?.length) {
          resolved.byDay[d] = [{ openMin: 0, closeMin: 1440 }];
        }
      }
    }
    hoursCache.set(cacheKey, { at: Date.now(), hours: resolved });
    return resolved;
  } catch (err) {
    console.warn('[openingHours] Google fetch failed:', err);
    hoursCache.set(cacheKey, { at: Date.now(), hours: null });
    return null;
  }
}

function buildQuery(input: ScheduleCheckInput): string {
  const parts = [
    input.name || input.title,
    input.location,
  ].filter(Boolean);
  // Pull q= from maps URL when present
  if (input.mapsUrl) {
    try {
      const u = new URL(input.mapsUrl);
      const q = u.searchParams.get('q');
      if (q) return q;
    } catch {
      /* ignore */
    }
  }
  return parts.join(' ');
}

function eventWindow(input: ScheduleCheckInput): { start: number; end: number } {
  if (input.allDay) return { start: 0, end: 1440 };
  const start = Math.max(0, Number(input.startMinute) || 0);
  const dur = Math.max(15, Number(input.durationMins) || 60);
  return { start, end: start + dur };
}

function windowFullyInside(periods: DayPeriod[], start: number, end: number): boolean {
  if (!periods.length) return false;
  // Allow end past midnight by checking overlap with extended periods
  return periods.some((p) => start >= p.openMin && end <= p.closeMin);
}

function windowOverlapsOpen(periods: DayPeriod[], start: number, end: number): boolean {
  if (!periods.length) return false;
  return periods.some((p) => start < p.closeMin && end > p.openMin);
}

function summarizeGoogleDay(hours: ResolvedHours, dow: number): string {
  if (hours.alwaysOpen) return 'פתוח 24/7';
  const dayText = weekdayTextForJsDow(hours.weekdayText, dow);
  if (is24hTextLine(dayText)) return 'פתוח 24/7';
  if (dayText) return dayText;
  const periods = hours.byDay[dow] || [];
  if (!periods.length) return 'סגור';
  return periods
    .map((p) => {
      const close = p.closeMin >= 1440 ? fmtMin(p.closeMin - 1440) + ' (+1)' : fmtMin(p.closeMin);
      return `${fmtMin(p.openMin)}–${close}`;
    })
    .join(', ');
}

function checkAgainstGoogle(
  input: ScheduleCheckInput,
  hours: ResolvedHours,
): ScheduleWarning[] {
  if (hours.alwaysOpen) return [];
  const dow = dayOfWeek(input.date);
  const dayLabel = DAY_HE[dow];
  const dayText = weekdayTextForJsDow(hours.weekdayText, dow);
  // Never warn closed when that weekday is 24h
  if (is24hTextLine(dayText)) return [];

  let periods = hours.byDay[dow] || [];
  // If byDay empty but text isn't closed, don't invent CLOSED_ALL_DAY
  if (!periods.length && dayText && !/סגור|closed/i.test(dayText)) {
    // Unknown precise intervals — do not critical-warn
    return [];
  }

  const { start, end } = eventWindow(input);
  const hoursSummary = summarizeGoogleDay(hours, dow);
  const place = hours.placeName || input.title;

  if (!periods.length) {
    const food = isFoodCategory(input.category, input.title);
    return [
      {
        severity: 'critical',
        code: food ? 'RESTAURANT_CLOSED' : 'CLOSED_ALL_DAY',
        message: food
          ? `🚫 המסעדה "${place}" סגורה כל היום ביום ${dayLabel} — לא לשבץ ארוחה.`
          : `${place} סגור ביום ${dayLabel} לפי שעות הפתיחה`,
        dayLabel,
        hoursSummary: hoursSummary || 'סגור',
        source: 'google',
      },
    ];
  }

  // all-day handled above in checkEventOpeningHours (no warnings)

  if (!windowOverlapsOpen(periods, start, end)) {
    const food = isFoodCategory(input.category, input.title);
    return [
      {
        severity: 'critical',
        code: food ? 'RESTAURANT_CLOSED' : 'CLOSED_AT_TIME',
        message: food
          ? `🚫 המסעדה "${place}" סגורה ביום ${dayLabel} בשעה ${fmtMin(start)} — אל תשריינו שם ארוחה. שעות: ${hoursSummary}`
          : `${place} סגור ביום ${dayLabel} בשעה ${fmtMin(start)} (שעות: ${hoursSummary})`,
        dayLabel,
        hoursSummary,
        source: 'google',
      },
    ];
  }

  // Open according to Google, but kitchen may already be closed for food at 22:00+
  if (
    isFoodCategory(input.category, input.title) &&
    !input.allDay &&
    start >= 22 * 60
  ) {
    // still open on paper — soft kitchen warning only
    return [
      {
        severity: 'warn',
        code: 'RESTAURANT_KITCHEN_LATE',
        message: `"${place}" אמנם פתוח לפי Google עד ${hoursSummary}, אבל ב-${fmtMin(start)} המטבח עלול להיות סגור — בדקו last order.`,
        dayLabel,
        hoursSummary,
        source: 'google',
      },
    ];
  }

  if (!windowFullyInside(periods, start, end)) {
    return [
      {
        severity: 'warn',
        code: 'PARTIAL_HOURS',
        message: `חלק מהזמן של "${input.title}" (${fmtMin(start)}–${fmtMin(end)}) מחוץ לשעות הפתיחה (${hoursSummary})`,
        dayLabel,
        hoursSummary,
        source: 'google',
      },
    ];
  }

  return [];
}

function heuristicWarnings(input: ScheduleCheckInput): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  const dow = dayOfWeek(input.date);
  const dayLabel = DAY_HE[dow];
  const { start, end } = eventWindow(input);
  const title = input.title || input.name || '';
  const food = isFoodCategory(input.category, title);
  const attraction = isAttractionCategory(input.category, title);
  const shop = isShopLike(title);

  // ── Food / restaurants late night (used when Google hours unavailable) ──
  if (food && !input.allDay) {
    if (start >= 22 * 60) {
      warnings.push({
        severity: 'critical',
        code: 'RESTAURANT_CLOSED',
        message: `🚫 המסעדה "${title}" מתוזמנת ליום ${dayLabel} בשעה ${fmtMin(start)} — בשעה הזו מסעדות רבות כבר סגורות / המטבח לא פעיל. הזיזו לשעה מוקדמת יותר או בדקו שעות פתיחה.`,
        dayLabel,
        hoursSummary: 'מסעדות רבות סוגרות ~21:30–22:30',
        source: 'heuristic',
      });
    } else if (start >= 21 * 60 + 30 || end > 22 * 60 + 30) {
      warnings.push({
        severity: 'warn',
        code: 'RESTAURANT_KITCHEN',
        message: `"${title}" מתוזמן לערב מאוחר (${fmtMin(start)}). במסעדות רבות המטבח נסגר בסביבות 22:00 — כדאי לוודא.`,
        dayLabel,
        hoursSummary: 'מטבח לרוב עד ~22:00',
        source: 'heuristic',
      });
    } else if (start < 10 * 60 && start > 0) {
      warnings.push({
        severity: 'warn',
        code: 'RESTAURANT_EARLY',
        message: `מסעדה ב-${fmtMin(start)} — רוב המסעדות נפתחות רק בצהריים / בוקר מאוחר.`,
        dayLabel,
        source: 'heuristic',
      });
    }
  }

  // ── Museums / attractions: Monday closed (common in DE/EU) ──
  // Skip evening-ok activities (escape rooms often open Mon evenings)
  // Downgraded to 'warn' — many places ARE open on Monday
  if (attraction && dow === 1 && !isEveningOkActivity(title, input.category)) {
    warnings.push({
      severity: 'warn',
      code: 'ATTRACTION_MONDAY',
      message: `"${title}" מתוזמן ליום שני — חלק מהמוזיאונים באירופה סגורים בימי שני. כדאי לבדוק.`,
      dayLabel,
      hoursSummary: 'סגירה טיפוסית: יום שני',
      source: 'heuristic',
    });
  }

  // ── Sunday: shops closed in DE; some attractions shorter hours ──
  if (dow === 0) {
    if (shop) {
      warnings.push({
        severity: 'critical',
        code: 'SHOP_SUNDAY',
        message: `"${title}" מתוזמן ליום ראשון — חנויות רבות בגרמניה סגורות בימי ראשון.`,
        dayLabel,
        source: 'heuristic',
      });
    } else if (attraction && !input.allDay && start >= 17 * 60) {
      warnings.push({
        severity: 'warn',
        code: 'ATTRACTION_SUNDAY_LATE',
        message: `אטרקציה ביום ראשון אחרי ${fmtMin(start)} — בימי ראשון שעות הפתיחה לעיתים קצרות יותר. בדקו מתי נסגר.`,
        dayLabel,
        source: 'heuristic',
      });
    } else if (attraction) {
      warnings.push({
        severity: 'warn',
        code: 'ATTRACTION_SUNDAY',
        message: `"${title}" ביום ראשון — ודאו שהמקום פתוח (חלק מהאתרים/שווקים סגורים או עם שעות מקוצרות).`,
        dayLabel,
        source: 'heuristic',
      });
    }
  }

  // ── Early morning: museums/attractions CLOSED (04:00, 06:00, …) ──
  // Critical — user must be told (e.g. FC Bayern Museum at 04:00)
  if (!input.allDay && !food && start < 9 * 60) {
    const looksMuseum = /museum|מוזיא|palace|castle|טיר|ארמון|gallery|גלרי|arena|welt|residenz|pinakothek/i.test(
      title,
    );
    if (attraction || looksMuseum) {
      warnings.push({
        severity: 'critical',
        code: 'ATTRACTION_CLOSED_EARLY',
        message: `🚫 "${title}" סגור בשעה ${fmtMin(start)} ביום ${dayLabel}. מוזיאונים ואטרקציות נפתחים בדרך כלל רק ב-9:00–10:00 — הזיזו את האירוע.`,
        dayLabel,
        hoursSummary: 'פתיחה טיפוסית 09:00–10:00',
        source: 'heuristic',
      });
    } else if (start < 7 * 60) {
      warnings.push({
        severity: 'critical',
        code: 'PLACE_CLOSED_EARLY',
        message: `🚫 "${title}" מתוזמן ל-${fmtMin(start)} — כמעט כל המקומות סגורים בשעה הזו.`,
        dayLabel,
        source: 'heuristic',
      });
    }
  }

  // ── Late evening museums only (escape rooms / bars / shows are fine at 20:00) ──
  if (
    attraction &&
    !input.allDay &&
    !food &&
    !isEveningOkActivity(title, input.category) &&
    start >= 18 * 60
  ) {
    const looksMuseum = /museum|מוזיא|palace|castle|טיר|ארמון|gallery|גלרי|welt|residenz|pinakothek/i.test(
      title,
    );
    // Only hard-flag clear museums/culture; generic "munich" category activities at 19:00 may be ok
    if (looksMuseum || start >= 20 * 60) {
      warnings.push({
        severity: looksMuseum || start >= 21 * 60 ? 'critical' : 'warn',
        code: 'ATTRACTION_CLOSED_LATE',
        message:
          start >= 20 * 60
            ? `🚫 "${title}" מתוזמן ל-${fmtMin(start)} — מוזיאונים רבים כבר סגורים בערב.`
            : `"${title}" ב-${fmtMin(start)} — מוזיאונים רבים נסגרים בסביבות 17:00–18:00. בדקו שעות.`,
        dayLabel,
        hoursSummary: 'סגירה טיפוסית ~17:00–18:00',
        source: 'heuristic',
      });
    }
  }

  // ── Very late anything non-nightlife ──
  if (!input.allDay && start >= 23 * 60 && !food && !isEveningOkActivity(title, input.category)) {
    warnings.push({
      severity: 'critical',
      code: 'VERY_LATE',
      message: `🚫 "${title}" מתוזמן ל-${fmtMin(start)} — רוב המקומות סגורים בשעה הזו.`,
      dayLabel,
      source: 'heuristic',
    });
  }

  return warnings;
}

/** Deduplicate by code, prefer critical + google */
function mergeWarnings(list: ScheduleWarning[]): ScheduleWarning[] {
  const map = new Map<string, ScheduleWarning>();
  for (const w of list) {
    const prev = map.get(w.code);
    if (!prev) {
      map.set(w.code, w);
      continue;
    }
    if (w.severity === 'critical' && prev.severity !== 'critical') map.set(w.code, w);
    else if (w.source === 'google' && prev.source !== 'google') map.set(w.code, w);
  }
  // Prefer critical first
  return [...map.values()].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1,
  );
}

/**
 * Main entry: check if scheduling this event is risky.
 * Always runs heuristics (so 04:00 museum / 22:00 restaurant never silent).
 * Google hours, when available, add precise closed/open messages.
 */
export async function checkEventOpeningHours(
  input: ScheduleCheckInput,
): Promise<ScheduleWarning[]> {
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return [];

  // All-day items (hotel, travel day, …) intentionally share the day with
  // timed activities — never warn about "limited hours" / closed-at-time.
  if (input.allDay) return [];

  // Flights / transfers are not venues — never Google "טיסה" as a place
  if (isNonPlaceScheduleItem(input.title || input.name, input.category)) {
    return [];
  }

  // 0) Check database openingHours first (highest priority)
  if (input.openingHours !== undefined) {
    // null means 24/7
    if (input.openingHours === null) return [];

    // If has weekday_text, parse and check
    if (input.openingHours && typeof input.openingHours === 'object' && input.openingHours.weekday_text) {
      try {
        const hours = parseWeekdayTextToHours(input.openingHours.weekday_text, input.title || input.name || 'Place');
        if (hours.alwaysOpen) return [];
        const warnings = checkAgainstGoogle(input, hours);
        return mergeWarnings(warnings);
      } catch (err) {
        console.warn('[openingHours] failed to parse DB weekday_text:', err);
      }
    }
  }

  // 1) Google API when possible — if place is 24/7 or open at that time, trust it
  //    (do NOT overlay heuristics that claim "closed" for a 24h venue)
  const query = buildQuery(input);
  const titleLen = (input.title || input.name || '').trim().length;
  const canGoogle =
    Boolean(input.mapsUrl) ||
    (titleLen >= 6 && !isNonPlaceScheduleItem(input.title || input.name, input.category));

  if (query && config.googleMapsKey && canGoogle) {
    try {
      const hours = await fetchGoogleHours(query);
      if (hours) {
        if (hours.alwaysOpen) return [];
        const googleWarnings = checkAgainstGoogle(input, hours);
        // Google resolved hours for this place → trust it fully (incl. empty = open OK)
        // Only soft kitchen warn from Google may remain; no heuristic CLOSED_*
        return mergeWarnings(googleWarnings);
      }
    } catch (err) {
      console.warn('[openingHours] google branch failed:', err);
    }
  }

  // 2) No data → heuristics only
  return mergeWarnings(heuristicWarnings(input));
}

/** Fast batch: heuristics only (for getPlanner — must be instant). */
export function checkEventsOpeningHoursFast(
  events: Array<ScheduleCheckInput & { id: string }>,
): Record<string, ScheduleWarning[]> {
  const out: Record<string, ScheduleWarning[]> = {};
  for (const ev of events) {
    try {
      const w = heuristicWarnings(ev);
      if (w.length) out[ev.id] = mergeWarnings(w);
    } catch {
      /* ignore */
    }
  }
  return out;
}

/** Full batch with Google (use sparingly; create/update/check endpoint). */
export async function checkEventsOpeningHours(
  events: Array<ScheduleCheckInput & { id: string }>,
  opts?: { maxGoogle?: number },
): Promise<Record<string, ScheduleWarning[]>> {
  const out: Record<string, ScheduleWarning[]> = {};
  const maxGoogle = opts?.maxGoogle ?? 8;
  let googleUsed = 0;
  for (const ev of events) {
    try {
      // Always heuristics; Google only for first N to avoid timeouts
      if (googleUsed < maxGoogle) {
        const w = await checkEventOpeningHours(ev);
        googleUsed += 1;
        if (w.length) out[ev.id] = w;
      } else {
        const w = mergeWarnings(heuristicWarnings(ev));
        if (w.length) out[ev.id] = w;
      }
    } catch (err) {
      console.warn('[openingHours] check failed for', ev.id, err);
    }
  }
  return out;
}

/** Heuristics only — exported for tests / fast path */
export function checkEventOpeningHoursHeuristic(
  input: ScheduleCheckInput,
): ScheduleWarning[] {
  return mergeWarnings(heuristicWarnings(input));
}

export function worstSeverity(
  warnings: ScheduleWarning[],
): ScheduleWarningSeverity | null {
  if (!warnings.length) return null;
  return warnings.some((w) => w.severity === 'critical') ? 'critical' : 'warn';
}
