/**
 * Live flight lookup — AviationStack when config.aviationstackApiKey is set.
 *
 * Free tier caveats:
 * - Often only returns the latest/current occurrence of a flight number
 * - flight_date filter is usually blocked (function_access_restricted)
 * - So we MUST compare API flight date vs user's planned date and not
 *   show "landed" for a trip flight two days from now.
 */

import { config } from '../config/env';

export interface LiveFlightInfo {
  flightNumber: string;
  status: string | null;
  statusLabel: string;
  /** Extra Hebrew note when status is approximate / not for user's date */
  statusNote: string | null;
  airline: string | null;
  aircraft: string | null;
  departure: {
    airport: string | null;
    iata: string | null;
    terminal: string | null;
    gate: string | null;
    scheduled: string | null;
    estimated: string | null;
    actual: string | null;
    delayMin: number | null;
  };
  arrival: {
    airport: string | null;
    iata: string | null;
    terminal: string | null;
    gate: string | null;
    scheduled: string | null;
    estimated: string | null;
    actual: string | null;
    delayMin: number | null;
  };
  departureLabel: string | null;
  arrivalLabel: string | null;
  /** YYYY-MM-DD from API */
  apiFlightDate: string | null;
  /** True when API occurrence matches the user's planned date */
  dateMatched: boolean;
  source: 'aviationstack' | 'stored';
  fetchedAt: string;
}

const STATUS_HE: Record<string, string> = {
  scheduled: 'מתוכנן',
  active: 'באוויר',
  landed: 'נחת',
  cancelled: 'בוטל',
  incident: 'תקרית',
  diverted: 'הוסט',
  delayed: 'מתעכב',
  boarding: 'עלייה למטוס',
};

function heStatus(raw: string | null | undefined): string {
  if (!raw) return 'לא ידוע';
  const k = raw.toLowerCase();
  return STATUS_HE[k] || raw;
}

function clean(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function dayKey(isoOrDate: string | null | undefined): string | null {
  if (!isoOrDate) return null;
  // "2026-07-13T00:00:00.000Z" or "2026-07-13" or "2026-07-10T01:00:00+00:00"
  const m = String(isoOrDate).match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Prefer IATA code, fall back to airport name */
export function airportLabel(iata?: string | null, airport?: string | null): string | null {
  return clean(iata) || clean(airport);
}

export function normalizeFlightNumber(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function isLiveFlightEnabled(): boolean {
  return Boolean(config.aviationstackApiKey);
}

function mapFlight(num: string, f: any, requestedDate?: string | null): LiveFlightInfo {
  const depIata = clean(f.departure?.iata);
  const arrIata = clean(f.arrival?.iata);
  const depAirport = clean(f.departure?.airport);
  const arrAirport = clean(f.arrival?.airport);

  const apiFlightDate =
    dayKey(f.flight_date) ||
    dayKey(f.departure?.scheduled) ||
    dayKey(f.departure?.estimated) ||
    null;

  const requested = dayKey(requestedDate);
  // If user didn't pick a date, treat as matched
  const dateMatched = !requested || !apiFlightDate || requested === apiFlightDate;

  let status = clean(f.flight_status);
  let statusLabel = heStatus(f.flight_status);
  let statusNote: string | null = null;

  if (!dateMatched && requested) {
    // Don't show "נחת" / "באוויר" from a different day's occurrence
    const pastOrOther = apiFlightDate && apiFlightDate !== requested;
    if (pastOrOther) {
      if (requested > todayKey()) {
        status = 'scheduled';
        statusLabel = 'מתוכנן';
        statusNote = `סטטוס חי עדיין לא זמין ל־${requested} (המערכת ראתה טיסה מ־${apiFlightDate})`;
      } else if (requested < todayKey()) {
        // historical user date different from what API returned
        statusNote = `מוצג לפי טיסה מ־${apiFlightDate}, לא בדיוק התאריך שבחרתם`;
      } else {
        statusNote = `נתונים מתאריך ${apiFlightDate}`;
      }
    }
  }

  return {
    flightNumber: num,
    status,
    statusLabel,
    statusNote,
    airline: clean(f.airline?.name),
    aircraft: clean(f.aircraft?.iata) || clean(f.aircraft?.icao),
    departure: {
      airport: depAirport,
      iata: depIata,
      terminal: clean(f.departure?.terminal),
      gate: clean(f.departure?.gate),
      scheduled: clean(f.departure?.scheduled),
      estimated: clean(f.departure?.estimated),
      actual: clean(f.departure?.actual),
      delayMin: f.departure?.delay != null ? Number(f.departure.delay) : null,
    },
    arrival: {
      airport: arrAirport,
      iata: arrIata,
      terminal: clean(f.arrival?.terminal),
      gate: clean(f.arrival?.gate),
      scheduled: clean(f.arrival?.scheduled),
      estimated: clean(f.arrival?.estimated),
      actual: clean(f.arrival?.actual),
      delayMin: f.arrival?.delay != null ? Number(f.arrival.delay) : null,
    },
    departureLabel: airportLabel(depIata, depAirport),
    arrivalLabel: airportLabel(arrIata, arrAirport),
    apiFlightDate,
    dateMatched,
    source: 'aviationstack',
    fetchedAt: new Date().toISOString(),
  };
}

async function queryAviationStack(
  params: URLSearchParams,
): Promise<any | null> {
  const key = config.aviationstackApiKey;
  if (!key) return null;
  const q = new URLSearchParams(params);
  q.set('access_key', key);
  if (!q.get('limit')) q.set('limit', '3');

  // Free plan is most reliable over plain HTTP
  const bases = [
    'http://api.aviationstack.com/v1/flights',
    'https://api.aviationstack.com/v1/flights',
  ];

  for (const base of bases) {
    try {
      const r = await fetch(`${base}?${q.toString()}`);
      if (r.status === 403 || r.status === 429) {
        console.warn('[flights] aviationstack rate/plan limit', r.status);
        return null;
      }
      if (!r.ok) {
        console.warn('[flights] aviationstack HTTP', r.status, base);
        continue;
      }
      const data: any = await r.json();
      if (data?.error) {
        console.warn(
          '[flights] aviationstack error:',
          data.error?.code || data.error?.message || data.error,
        );
        return null;
      }
      if (Array.isArray(data?.data) && data.data.length) return data.data;
      return null;
    } catch (err) {
      console.warn('[flights] fetch failed', base, err);
    }
  }
  return null;
}

function pickBestOccurrence(rows: any[], requestedDate?: string | null): any | null {
  if (!rows?.length) return null;
  const requested = dayKey(requestedDate);
  if (requested) {
    const exact = rows.find((f) => {
      const d =
        dayKey(f.flight_date) ||
        dayKey(f.departure?.scheduled) ||
        dayKey(f.departure?.estimated);
      return d === requested;
    });
    if (exact) return exact;

    // Prefer future/scheduled over already-landed when dates don't match
    const scheduled = rows.find((f) =>
      ['scheduled', 'active', 'delayed'].includes(String(f.flight_status || '').toLowerCase()),
    );
    if (scheduled && requested > todayKey()) return scheduled;
  }
  return rows[0];
}

/**
 * Lookup live flight. Free tier usually cannot filter by future date,
 * so callers must respect dateMatched / statusNote.
 */
export async function fetchLiveFlight(
  flightNumber: string,
  flightDate?: string | null,
): Promise<LiveFlightInfo | null> {
  if (!config.aviationstackApiKey) return null;

  const num = normalizeFlightNumber(flightNumber);
  const date = dayKey(flightDate);

  // 1) flight_iata — free tier main path
  {
    const rows = await queryAviationStack(new URLSearchParams({ flight_iata: num }));
    if (rows) {
      const f = pickBestOccurrence(rows, date);
      if (f) return mapFlight(num, f, date);
    }
  }

  // 2) with date (often blocked on free plan — try anyway)
  if (date) {
    const rows = await queryAviationStack(
      new URLSearchParams({ flight_iata: num, flight_date: date }),
    );
    if (rows) {
      const f = pickBestOccurrence(rows, date);
      if (f) return mapFlight(num, f, date);
    }
  }

  // 3) airline_iata + flight_number
  const m = num.match(/^([A-Z]{1,3})(\d{1,4}[A-Z]?)$/);
  if (m) {
    const rows = await queryAviationStack(
      new URLSearchParams({ airline_iata: m[1], flight_number: m[2] }),
    );
    if (rows) {
      const f = pickBestOccurrence(rows, date);
      if (f) return mapFlight(num, f, date);
    }
  }

  return null;
}

export function minutesUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 60000);
}
