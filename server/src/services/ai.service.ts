/**
 * Claude-powered helpers for TRIPO.
 * Used by timeline (recaps / polish) and notifications (smart copy).
 * Never throws to callers for optional polish — returns null on failure.
 *
 * Token usage is logged on every call and accumulated in-process for benchmarks.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';
import { prisma } from '../lib/prisma';

// Providers: OpenAI (primary, OPENAI_API_KEY / OPEN_API_KEY) → Anthropic (fallback)
const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-5-20250929';
const useOpenAi = () => Boolean(config.openaiApiKey);
export const AI_MODEL = config.openaiApiKey ? OPENAI_MODEL : ANTHROPIC_MODEL;
const MODEL = AI_MODEL;

/** Call OpenAI chat completions. Returns text + token usage. Throws on failure. */
async function callOpenAi(
  system: string,
  user: string,
  maxTokens: number,
  jsonMode: boolean,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`openai_http_${resp.status}: ${body.slice(0, 300)}`);
  }
  const data: any = await resp.json();
  return {
    text: data?.choices?.[0]?.message?.content || '',
    inputTokens: data?.usage?.prompt_tokens ?? 0,
    outputTokens: data?.usage?.completion_tokens ?? 0,
  };
}

/** USD per 1M tokens — override via env if pricing changes */
export const AI_PRICE_INPUT_PER_MTOK = Number(process.env.AI_PRICE_INPUT_PER_MTOK || 3);
export const AI_PRICE_OUTPUT_PER_MTOK = Number(process.env.AI_PRICE_OUTPUT_PER_MTOK || 15);

export type AiFeature =
  | 'timeline_day_stories'
  | 'timeline_line_polish'
  | 'notification_polish'
  | 'smart_notifications_digest'
  | 'ai_schedule'
  | 'other';

export interface AiTokenUsage {
  feature: AiFeature | string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  maxTokens: number;
  estimatedUsd: number;
  systemChars: number;
  userChars: number;
  at: string;
  ok: boolean;
  error?: string;
}

const usageLog: AiTokenUsage[] = [];

export function getAiUsageLog(): AiTokenUsage[] {
  return [...usageLog];
}

export function clearAiUsageLog(): void {
  usageLog.length = 0;
}

export function summarizeAiUsage(entries = usageLog) {
  const input = entries.reduce((s, e) => s + e.inputTokens, 0);
  const output = entries.reduce((s, e) => s + e.outputTokens, 0);
  const usd = entries.reduce((s, e) => s + e.estimatedUsd, 0);
  return {
    calls: entries.length,
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
    estimatedUsd: usd,
    byFeature: groupByFeature(entries),
  };
}

function groupByFeature(entries: AiTokenUsage[]) {
  const map: Record<
    string,
    { calls: number; inputTokens: number; outputTokens: number; estimatedUsd: number }
  > = {};
  for (const e of entries) {
    if (!map[e.feature]) {
      map[e.feature] = { calls: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0 };
    }
    const g = map[e.feature];
    g.calls += 1;
    g.inputTokens += e.inputTokens;
    g.outputTokens += e.outputTokens;
    g.estimatedUsd += e.estimatedUsd;
  }
  return map;
}

function estimateUsd(input: number, output: number): number {
  return (input / 1_000_000) * AI_PRICE_INPUT_PER_MTOK + (output / 1_000_000) * AI_PRICE_OUTPUT_PER_MTOK;
}

function recordUsage(partial: Omit<AiTokenUsage, 'totalTokens' | 'estimatedUsd' | 'at'> & { at?: string }) {
  const entry: AiTokenUsage = {
    ...partial,
    totalTokens: partial.inputTokens + partial.outputTokens,
    estimatedUsd: estimateUsd(partial.inputTokens, partial.outputTokens),
    at: partial.at || new Date().toISOString(),
  };
  usageLog.push(entry);
  console.log(
    `[ai:tokens] ${entry.feature} model=${entry.model} in=${entry.inputTokens} out=${entry.outputTokens} total=${entry.totalTokens} ~$${entry.estimatedUsd.toFixed(6)} ok=${entry.ok}`,
  );
  return entry;
}

function client(): Anthropic | null {
  if (!config.anthropicApiKey) return null;
  return new Anthropic({ apiKey: config.anthropicApiKey });
}

export function isAiConfigured(): boolean {
  return Boolean(config.openaiApiKey || config.anthropicApiKey);
}

/** AI allowed for this trip + acting user (key, toggles, plan quota) */
export async function isAiAllowedForTrip(
  tripId: string,
  userId?: string | null,
): Promise<boolean> {
  if (!isAiConfigured()) return false;

  try {
    if (userId) {
      const { assertCanUseAi } = await import('./limits.service');
      await assertCanUseAi(userId, tripId);
      return true;
    }
  } catch {
    return false;
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { aiEnabled: true },
  });
  return Boolean(trip?.aiEnabled);
}

export interface CompleteResult<T> {
  data: T | null;
  usage: AiTokenUsage | null;
}

/** Unified completion: OpenAI first (OPENAI_API_KEY / OPEN_API_KEY), Anthropic fallback */
async function completeRaw(
  system: string,
  user: string,
  maxTokens: number,
  feature: AiFeature | string,
  jsonMode: boolean,
): Promise<string | null> {
  if (useOpenAi()) {
    try {
      const r = await callOpenAi(system, user, maxTokens, jsonMode);
      recordUsage({
        feature,
        model: OPENAI_MODEL,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        maxTokens,
        systemChars: system.length,
        userChars: user.length,
        ok: true,
      });
      return r.text;
    } catch (err: any) {
      recordUsage({
        feature,
        model: OPENAI_MODEL,
        inputTokens: 0,
        outputTokens: 0,
        maxTokens,
        systemChars: system.length,
        userChars: user.length,
        ok: false,
        error: err?.message || 'unknown',
      });
      console.error('[ai] openai failed:', err?.message || err);
      // fall through to Anthropic if configured
    }
  }
  const c = client();
  if (!c) {
    if (!useOpenAi()) {
      recordUsage({
        feature,
        model: MODEL,
        inputTokens: 0,
        outputTokens: 0,
        maxTokens,
        systemChars: system.length,
        userChars: user.length,
        ok: false,
        error: 'no_api_key',
      });
    }
    return null;
  }
  try {
    const msg = await c.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    recordUsage({
      feature,
      model: ANTHROPIC_MODEL,
      inputTokens: msg.usage?.input_tokens ?? 0,
      outputTokens: msg.usage?.output_tokens ?? 0,
      maxTokens,
      systemChars: system.length,
      userChars: user.length,
      ok: true,
    });
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  } catch (err: any) {
    recordUsage({
      feature,
      model: ANTHROPIC_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      maxTokens,
      systemChars: system.length,
      userChars: user.length,
      ok: false,
      error: err?.error?.error?.message || err?.message || 'unknown',
    });
    console.error('[ai] anthropic failed:', err?.error?.error?.message || err?.message || err);
    return null;
  }
}

async function completeJson(
  system: string,
  user: string,
  maxTokens = 1024,
  feature: AiFeature | string = 'other',
): Promise<any | null> {
  const text = await completeRaw(system, user, maxTokens, feature, true);
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function completeText(
  system: string,
  user: string,
  maxTokens = 400,
  feature: AiFeature | string = 'other',
): Promise<string | null> {
  const text = await completeRaw(system, user, maxTokens, feature, false);
  return text ? text.trim() : null;
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export interface TimelineRecapResult {
  title: string;
  description: string;
  emoji: string;
}

export interface TimelineDayStory {
  /** YYYY-MM-DD */
  date: string;
  title: string;
  description: string;
  emoji: string;
}

function dayKeyOf(occurredAt: Date | string): string {
  if (typeof occurredAt === 'string') return occurredAt.slice(0, 10);
  return occurredAt.toISOString().slice(0, 10);
}

function formatHeDate(isoDay: string): string {
  try {
    return new Date(isoDay + 'T12:00:00').toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return isoDay;
  }
}

/** Overall short recap (legacy single-shot) */
export async function generateTimelineRecap(opts: {
  tripName: string;
  events: { emoji: string; title: string; description?: string | null; occurredAt: Date | string }[];
}): Promise<TimelineRecapResult | null> {
  const days = await generateTimelineDayStories(opts);
  if (!days?.length) return null;
  if (days.length === 1) {
    return {
      title: days[0].title,
      description: days[0].description,
      emoji: days[0].emoji,
    };
  }
  // Aggregate intro from first day titles if model only returned days
  return {
    title: `סיפור ${opts.tripName} — ${days.length} ימים`,
    description: days.map((d) => `${formatHeDate(d.date)}: ${d.title}`).join('\n'),
    emoji: '✨',
  };
}

/**
 * Full day-by-day AI timeline: one story card per calendar day that has events.
 */
export async function generateTimelineDayStories(opts: {
  tripName: string;
  events: {
    emoji: string;
    title: string;
    description?: string | null;
    occurredAt: Date | string;
    category?: string;
  }[];
  plannerByDay?: Record<string, string[]>;
}): Promise<TimelineDayStory[] | null> {
  // Group non-AI events by day
  const byDay = new Map<string, typeof opts.events>();
  for (const e of opts.events) {
    const k = dayKeyOf(e.occurredAt);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(e);
  }

  const days = [...byDay.keys()].sort(); // chronological
  if (!days.length) return null;

  // Cap days to keep prompt/cost reasonable
  const maxDays = 14;
  const selectedDays = days.length > maxDays ? days.slice(-maxDays) : days;

  const dayBlocks = selectedDays
    .map((day) => {
      const list = byDay.get(day) || [];
      const lines = list
        .map((e) => {
          const t =
            typeof e.occurredAt === 'string'
              ? e.occurredAt.slice(11, 16)
              : e.occurredAt.toISOString().slice(11, 16);
          return `  - ${t || '—'} ${e.emoji} ${e.title}${e.description ? ` (${e.description})` : ''}`;
        })
        .join('\n');
      const planner = opts.plannerByDay?.[day]?.length
        ? `\n  לוח זמנים: ${opts.plannerByDay[day].join(' · ')}`
        : '';
      return `### ${day} (${formatHeDate(day)})\n${lines}${planner}`;
    })
    .join('\n\n');

  const system = `אתה כותב יומן טיול קבוצתי בעברית — חם, קליל, מדויק.
לכל יום שיש בו אירועים, כתוב כרטיס סיפור קצר.

החזר JSON בלבד:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "title": "כותרת קצרה ליום (עד 60 תווים)",
      "description": "2-5 משפטים על מה קרה ביום הזה, לפי האירועים",
      "emoji": "emoji יחיד"
    }
  ]
}

חוקים:
- יום אחד בלבד לכל date שמופיע בקלט
- אל תמציא עובדות שלא מופיעות באירועים
- אפשר לקשר בין אירועים באותו יום לסיפור רציף
- אם יש לוח זמנים — שלב אותו בעדינות
- בלי טקסט מחוץ ל-JSON`;

  const user = `טיול: ${opts.tripName}

אירועים לפי ימים:
${dayBlocks}

כתוב סיפור AI מלא לכל יום ברשימה (בדיוק התאריכים האלה).`;

  const json = await completeJson(system, user, 2500, 'timeline_day_stories');
  if (!Array.isArray(json?.days) || !json.days.length) return null;

  const allowed = new Set(selectedDays);
  const out: TimelineDayStory[] = [];
  for (const d of json.days) {
    const date = String(d.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !allowed.has(date)) continue;
    if (!d.title || !d.description) continue;
    out.push({
      date,
      title: String(d.title).slice(0, 120),
      description: String(d.description).slice(0, 1200),
      emoji: String(d.emoji || '✨').slice(0, 8),
    });
  }

  // Ensure every day with events has a story; fill gaps with a simple fallback
  for (const day of selectedDays) {
    if (out.some((x) => x.date === day)) continue;
    const list = byDay.get(day) || [];
    out.push({
      date: day,
      title: `יום ${formatHeDate(day)}`,
      description: list.map((e) => `${e.emoji} ${e.title}`).join(' · ').slice(0, 500) || 'יום בטיול',
      emoji: list[0]?.emoji || '📅',
    });
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Optional polish of a single timeline line (fire-and-forget use) */
export async function polishTimelineLine(opts: {
  title: string;
  description?: string | null;
  type: string;
}): Promise<{ title: string; description: string | null } | null> {
  const system = `אתה עורך כותרות לציר זמן של טיול חברים בעברית.
החזר JSON: {"title":"...","description":"..." או null}
שמור על עובדות, קצר, חם, בלי הגזמות.`;

  const json = await completeJson(
    system,
    `סוג: ${opts.type}\nכותרת: ${opts.title}\nתיאור: ${opts.description || ''}`,
    1024,
    'timeline_line_polish',
  );
  if (!json?.title) return null;
  return {
    title: String(json.title).slice(0, 160),
    description: json.description != null ? String(json.description).slice(0, 500) : null,
  };
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface AiNotificationDraft {
  title: string;
  body: string;
  emoji: string;
  type: string;
  href?: string | null;
}

/** Turn rule-based tips into friendlier AI notification copy */
export async function polishNotificationTips(
  tripName: string,
  tips: { title: string; body: string; emoji: string; id: string }[],
): Promise<AiNotificationDraft[] | null> {
  if (!tips.length) return null;

  const system = `אתה כותב התראות קצרות לאפליקציית טיול קבוצתי בעברית.
החזר JSON בלבד:
{"items":[{"id":"...","title":"...","body":"...","emoji":"..."}]}
שמור על המשמעות, קצר (כותרת עד 60 תווים, גוף עד 140).`;

  const user = `טיול: ${tripName}
טיפים גולמיים:
${JSON.stringify(tips, null, 0)}`;

  const json = await completeJson(system, user, 1024, 'notification_polish');
  if (!Array.isArray(json?.items)) return null;

  return json.items
    .map((it: any) => {
      const src = tips.find((t) => t.id === it.id) || tips[0];
      return {
        title: String(it.title || src.title).slice(0, 80),
        body: String(it.body || src.body).slice(0, 200),
        emoji: String(it.emoji || src.emoji || '💡').slice(0, 8),
        type: 'ai',
        href: null as string | null,
      };
    })
    .slice(0, 5);
}

/** One-shot smart digests for a member */
export async function generateSmartNotifications(opts: {
  tripName: string;
  memberName: string;
  context: string;
}): Promise<AiNotificationDraft[] | null> {
  const system = `אתה יועץ טיול קבוצתי. כתוב 1-3 התראות שימושיות בעברית.
JSON בלבד:
{"items":[{"title":"...","body":"...","emoji":"...","type":"ai"}]}
רק דברים מעשיים (מזג אוויר, החלטות פתוחות, טיסות, הוצאות, לוח זמנים). בלי ספאם.`;

  const user = `טיול: ${opts.tripName}
חבר: ${opts.memberName}
הקשר:
${opts.context.slice(0, 3000)}`;

  const json = await completeJson(system, user, 1024, 'smart_notifications_digest');
  if (!Array.isArray(json?.items)) return null;
  return json.items
    .map((it: any) => ({
      title: String(it.title || 'עדכון').slice(0, 80),
      body: String(it.body || '').slice(0, 200),
      emoji: String(it.emoji || '💡').slice(0, 8),
      type: 'ai',
      href: null as string | null,
    }))
    .slice(0, 3);
}

// ─── AI Schedule (votes + dates + opening-hours awareness) ───────────────────

export interface AiScheduleActivityInput {
  id: string;
  name: string;
  emoji?: string;
  category?: string;
  durationMins: number;
  location?: string | null;
  mapsUrl?: string | null;
  color?: string;
  cost?: string | null;
  /** Aggregated vote score (higher = more wanted) */
  score: number;
  must: number;
  ok: number;
  against: number;
  totalVotes: number;
}

export interface AiScheduleSlot {
  activityId: string;
  title: string;
  date: string; // YYYY-MM-DD
  startMinute: number;
  durationMins: number;
  allDay?: boolean;
  color?: string;
  notes?: string | null;
  mapsUrl?: string | null;
  url?: string | null;
  cost?: string | null;
  reason?: string;
}

export interface AiScheduleResult {
  slots: AiScheduleSlot[];
  summaryHe: string;
  skipped: Array<{ activityId: string; name: string; reason: string }>;
}

/**
 * Build calendar from votes + open-hours windows.
 * Placement is deterministic (reliable). Claude only writes a short Hebrew summary.
 * Does NOT write to DB — preview then apply.
 */
export async function generateAiSchedule(opts: {
  tripName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  activities: AiScheduleActivityInput[];
  existingBusy?: Array<{ date: string; startMinute: number; durationMins: number; title: string }>;
  /** Hours blocked by flights (airport/transit) — no full-day activities on these dates */
  flightBlocks?: Array<{ date: string; start: number; end: number }>;
}): Promise<AiScheduleResult | null> {
  const days = listDays(opts.startDate, opts.endDate);
  if (!days.length || !opts.activities.length) return null;

  // Rank: MUST first, then score. Never drop pure top votes.
  const eligible = [...opts.activities]
    .filter((a) => a.against === 0 || a.must + a.ok >= a.against)
    .sort(
      (a, b) =>
        b.must - a.must ||
        b.score - a.score ||
        b.ok - a.ok ||
        a.name.localeCompare(b.name, 'he'),
    );

  if (!eligible.length) return null;

  // Must-include: every MUST, then top by score until capacity
  const capacity = Math.min(eligible.length, Math.max(days.length * 4, 8));
  const mustList = eligible.filter((a) => a.must > 0);
  const rest = eligible.filter((a) => a.must === 0);
  const toPlace: AiScheduleActivityInput[] = [];
  const seenIds = new Set<string>();
  for (const a of mustList) {
    if (!seenIds.has(a.id)) {
      toPlace.push(a);
      seenIds.add(a.id);
    }
  }
  for (const a of rest) {
    if (toPlace.length >= capacity) break;
    if (!seenIds.has(a.id)) {
      toPlace.push(a);
      seenIds.add(a.id);
    }
  }
  // Always keep top-3 by score even if capacity tight
  const top3 = [...eligible].sort((a, b) => b.score - a.score || b.must - a.must).slice(0, 3);
  for (const a of top3) {
    if (!seenIds.has(a.id)) {
      toPlace.unshift(a);
      seenIds.add(a.id);
    }
  }

  // Day occupancy: free blocks + busy from existing
  type Block = { start: number; end: number };
  const dayBusy = new Map<string, Block[]>();
  for (const d of days) dayBusy.set(d, []);
  for (const b of opts.existingBusy || []) {
    if (!dayBusy.has(b.date)) continue;
    dayBusy.get(b.date)!.push({
      start: b.startMinute,
      end: b.startMinute + Math.max(30, b.durationMins),
    });
  }

  // Flight days: block airport/transit hours and forbid full-day anchors
  const travelDays = new Set<string>();
  for (const fb of opts.flightBlocks || []) {
    if (!dayBusy.has(fb.date)) continue;
    travelDays.add(fb.date);
    dayBusy.get(fb.date)!.push({
      start: Math.max(0, Math.min(1439, fb.start)),
      end: Math.max(1, Math.min(1440, fb.end)),
    });
  }
  // No flight data? Assume first/last days are travel days (arrival/return)
  if (!(opts.flightBlocks || []).length && days.length >= 3) {
    travelDays.add(days[0]);
    travelDays.add(days[days.length - 1]);
  }

  const GAP = 30; // minutes between activities
  const slots: AiScheduleSlot[] = [];
  const placed = new Set<string>();

  // ── AI geo-clustering: label every activity with an area, even without coords ──
  const aiArea = new Map<string, string>();
  if (isAiConfigured() && eligible.length >= 3) {
    try {
      const list = eligible.map((a) => ({
        id: a.id,
        name: a.name,
        location: a.location || '',
      }));
      const json = await completeJson(
        'You group trip activities by geographic area. Activities in the same city or within ~45km driving belong to the same group; places far apart (e.g. Munich vs Black Forest) are different groups. ' +
          'Use your knowledge of where famous places actually are. ' +
          'Return JSON only: {"groups":[{"area":"short area name","ids":["id1","id2"]}]}. Every id appears exactly once.',
        JSON.stringify(list),
        Math.min(2000, 300 + list.length * 40),
        'ai_schedule',
      );
      if (Array.isArray(json?.groups)) {
        for (const g of json.groups) {
          const area = String(g?.area || '').trim().toLowerCase();
          if (!area || !Array.isArray(g?.ids)) continue;
          for (const id of g.ids) aiArea.set(String(id), area);
        }
        console.log(
          '[ai-schedule] areas:',
          [...new Set(aiArea.values())].join(' | ') || 'none',
        );
      }
    } catch {
      /* clustering is best-effort — coord/text fallback below */
    }
  }

  // ── Region clustering: keep each day in one area (e.g. Munich vs Black Forest)
  const coordOf = (a: AiScheduleActivityInput): { lat: number; lng: number } | null => {
    const u = a.mapsUrl || '';
    const m =
      u.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ||
      u.match(/[?&]q=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/) ||
      u.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/);
    return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
  };
  const distKm = (p: { lat: number; lng: number }, q: { lat: number; lng: number }) => {
    const dLat = (p.lat - q.lat) * 111;
    const dLng = (p.lng - q.lng) * 111 * Math.cos((p.lat * Math.PI) / 180);
    return Math.hypot(dLat, dLng);
  };
  const textRegionOf = (a: AiScheduleActivityInput): string | null => {
    const loc = (a.location || '').trim().toLowerCase();
    if (!loc) return null;
    return loc.split(',')[0].trim().slice(0, 32) || null;
  };
  const dayGeo = new Map<
    string,
    {
      coords: Array<{ lat: number; lng: number }>;
      regions: Map<string, number>;
      areas: Set<string>;
    }
  >();
  function bumpRegion(date: string, a: AiScheduleActivityInput) {
    if (!dayGeo.has(date)) {
      dayGeo.set(date, { coords: [], regions: new Map(), areas: new Set() });
    }
    const g = dayGeo.get(date)!;
    const area = aiArea.get(a.id);
    if (area) g.areas.add(area);
    const c = coordOf(a);
    if (c) g.coords.push(c);
    const r = textRegionOf(a);
    if (r) g.regions.set(r, (g.regions.get(r) || 0) + 1);
  }
  /** REGION_BLOCK and above = never same day. Negative = same area, group together. */
  const REGION_BLOCK = 700;
  function regionScore(date: string, a: AiScheduleActivityInput): number {
    const g = dayGeo.get(date);
    if (!g) return 0;
    // 1) AI area labels (most reliable — works without coords)
    const area = aiArea.get(a.id);
    if (area && g.areas.size) {
      return g.areas.has(area) ? -250 : 900;
    }
    // 2) Coordinates from maps links
    const c = coordOf(a);
    if (c && g.coords.length) {
      const minD = Math.min(...g.coords.map((p) => distKm(p, c)));
      if (minD <= 35) return -250; // same area — group together
      if (minD >= 80) return 900; // far (Munich ↔ Black Forest) — never same day
      return 200;
    }
    // 3) Location text
    const r = textRegionOf(a);
    if (r && g.regions.size) return (g.regions.get(r) || 0) > 0 ? -250 : 450;
    return 0;
  }

  const timedCount = (date: string) =>
    slots.filter((s) => s.date === date && !s.allDay).length;

  const isLodging = (a: AiScheduleActivityInput) =>
    /מלון|hotel|motel|hostel|לינה|אכסניה|airbnb/i.test(a.name) ||
    a.category === 'hotel';

  const isMuseumish = (a: AiScheduleActivityInput) =>
    /museum|מוזיא|palace|castle|טיר|ארמון|residenz|pinakothek|gallery|גלרי|welt/i.test(
      a.name,
    ) || ['munich', 'culture'].includes((a.category || '').toLowerCase());

  const isFood = (a: AiScheduleActivityInput) =>
    a.category === 'food' ||
    /מסעד|restaurant|hofbräu|brau|café|cafe|ביר|food|ארוח/i.test(a.name);

  const isEvening = (a: AiScheduleActivityInput) =>
    /escape|בריחה|exit the room|bar|club|halloween|traumatica|nightlife|מופע|show/i.test(
      a.name,
    );

  const isOutdoor = (a: AiScheduleActivityInput) =>
    ['forest', 'nature', 'special'].includes((a.category || '').toLowerCase()) ||
    /gorge|park|lake|אגם|טיול|hike|coaster|מפל/i.test(a.name);

  const isThemePark = (a: AiScheduleActivityInput) =>
    /europa.?park|יורופה|disney|phantasialand|legoland|heide.?park|port.?aventura|gardaland|rulantica|movie ?park|theme.?park|amusement|לונה.?פארק|פארק שעשועים/i.test(
      a.name,
    ) || ['themepark', 'amusement'].includes((a.category || '').toLowerCase());

  const isShopping = (a: AiScheduleActivityInput) =>
    (a.category || '').toLowerCase() === 'shopping' ||
    /shopping|outlet|mall|קניון|קניות|שופינג/i.test(a.name);

  const isMarket = (a: AiScheduleActivityInput) =>
    /(^|\s)market|(^|\s)שוק|viktualien/i.test(a.name);

  /** Activities that consume a whole day (theme parks, very long tours) */
  const isFullDayActivity = (a: AiScheduleActivityInput) =>
    !isLodging(a) && (isThemePark(a) || (a.durationMins || 0) >= 6 * 60);

  /** Allowed open windows for activity on a given weekday (0=Sun) */
  function windowsFor(a: AiScheduleActivityInput, dow: number): Block[] {
    if (isLodging(a)) return [{ start: 0, end: 1440 }]; // all-day
    if (isThemePark(a)) {
      // Crowds: avoid Sat/Sun. Parks run roughly 9:00–18:30
      if (dow === 0 || dow === 6) return [];
      return [{ start: 9 * 60, end: 18 * 60 + 30 }];
    }
    if (isMarket(a)) {
      // Markets are a morning thing; most closed Sunday in Europe
      if (dow === 0) return [];
      return [{ start: 8 * 60 + 30, end: 13 * 60 }];
    }
    if (isShopping(a)) {
      // Most European shops closed on Sunday
      if (dow === 0) return [];
      return [{ start: 10 * 60, end: 19 * 60 }];
    }
    if (isFood(a)) {
      if (/dinner|ערב|לילה/i.test(a.name)) {
        return [{ start: 18 * 60 + 30, end: 21 * 60 + 30 }]; // dinner only
      }
      if (/breakfast|בוקר|brunch|בראנץ/i.test(a.name)) {
        return [{ start: 8 * 60 + 30, end: 11 * 60 }]; // breakfast only
      }
      return [
        { start: 12 * 60 + 30, end: 15 * 60 }, // lunch
        { start: 18 * 60 + 30, end: 21 * 60 + 30 }, // dinner
      ];
    }
    if (isEvening(a)) {
      return [{ start: 17 * 60, end: 22 * 60 }];
    }
    if (isMuseumish(a)) {
      // Europe: many museums closed Monday
      if (dow === 1) return [];
      return [{ start: 10 * 60, end: 17 * 60 }];
    }
    if (isOutdoor(a)) {
      return [{ start: 9 * 60, end: 17 * 60 + 30 }];
    }
    if ((a.category || '') === 'travel') {
      return [{ start: 8 * 60, end: 20 * 60 }];
    }
    // default daytime
    if (dow === 1 && /museum|מוזיא/i.test(a.name)) return [];
    return [{ start: 9 * 60 + 30, end: 18 * 60 }];
  }

  function overlaps(a: Block, b: Block) {
    return a.start < b.end && b.start < a.end;
  }

  function findSlot(
    date: string,
    duration: number,
    windows: Block[],
  ): number | null {
    const busy = dayBusy.get(date) || [];
    for (const w of windows) {
      // try every 15 min in window
      const maxStart = w.end - duration;
      for (let t = w.start; t <= maxStart; t += 15) {
        const cand = { start: t, end: t + duration };
        // expand busy with GAP
        const conflict = busy.some((b) =>
          overlaps(cand, { start: b.start - GAP, end: b.end + GAP }),
        );
        if (!conflict) return t;
      }
    }
    return null;
  }

  /** Free minutes left in the "active day" window (9:00–21:30) */
  const DAY_START = 9 * 60;
  const DAY_END = 21 * 60 + 30;
  function freeMinutes(date: string): number {
    const busy = (dayBusy.get(date) || [])
      .slice()
      .sort((x, y) => x.start - y.start);
    let free = 0;
    let cur = DAY_START;
    for (const b of busy) {
      if (b.end <= DAY_START || b.start >= DAY_END) continue;
      if (b.start > cur) free += Math.min(b.start, DAY_END) - cur;
      cur = Math.max(cur, Math.min(b.end, DAY_END));
    }
    if (cur < DAY_END) free += DAY_END - cur;
    return free;
  }

  function placeActivity(a: AiScheduleActivityInput, preferDays?: string[]): boolean {
    if (placed.has(a.id)) return true;
    const fullDay = isFullDayActivity(a);
    const dur = fullDay
      ? Math.max(8 * 60, Math.min(9 * 60 + 30, a.durationMins || 9 * 60))
      : Math.max(45, Math.min(8 * 60, a.durationMins || 90));

    if (isLodging(a)) {
      // all-day on middle day or first full day
      const date = preferDays?.[0] || days[Math.min(1, days.length - 1)] || days[0];
      slots.push({
        activityId: a.id,
        title: a.name,
        date,
        startMinute: 0,
        durationMins: 1440,
        allDay: true,
        color: a.color || 'blue',
        mapsUrl: a.mapsUrl || null,
        cost: a.cost || null,
        notes: a.must > 0 ? 'עדיפות גבוהה מההצבעות (MUST)' : 'לינה',
        reason: a.must > 0 ? 'MUST מהקבוצה' : 'לינה',
      });
      placed.add(a.id);
      return true;
    }

    // Day scoring: emptiest day first (fill days evenly), weekday rules per type,
    // same-area grouping, and travel-day (flight) constraints
    const dayOrder = [...(preferDays || days)].sort((d1, d2) => {
      const dow1 = new Date(d1 + 'T12:00:00').getDay();
      const dow2 = new Date(d2 + 'T12:00:00').getDay();
      // less free time = later in order → fill emptiest day first
      let s1 = -freeMinutes(d1);
      let s2 = -freeMinutes(d2);
      if (isMuseumish(a)) {
        if (dow1 === 1) s1 += 1000; // museums closed Monday
        if (dow2 === 1) s2 += 1000;
      }
      if (isThemePark(a)) {
        // best: Tue–Thu, ok: Mon/Fri, avoid: Sat/Sun
        const parkPenalty = (dow: number) =>
          dow === 0 || dow === 6 ? 2000 : dow === 1 || dow === 5 ? 120 : 0;
        s1 += parkPenalty(dow1);
        s2 += parkPenalty(dow2);
      }
      if (fullDay) {
        // full-day activities need an empty day — penalize days that already have plans
        s1 += (dayBusy.get(d1) || []).length * 300;
        s2 += (dayBusy.get(d2) || []).length * 300;
      }
      // Same-area grouping (Munich day stays Munich, Black Forest day stays there)
      s1 += regionScore(d1, a);
      s2 += regionScore(d2, a);
      // Travel days are last choice for anything
      if (travelDays.has(d1)) s1 += 800;
      if (travelDays.has(d2)) s2 += 800;
      return s1 - s2;
    });

    const maxTimed = isFood(a) ? 5 : 4;
    for (const date of dayOrder) {
      // Never a full-day activity (theme park / long tour) on a flight day
      if (fullDay && travelDays.has(date)) continue;
      // HARD RULE: never mix far-apart areas on the same day
      if (regionScore(date, a) >= REGION_BLOCK) continue;
      // Don't overload one day while others are empty
      if (timedCount(date) >= maxTimed) continue;
      const dow = new Date(date + 'T12:00:00').getDay();
      const wins = windowsFor(a, dow);
      if (!wins.length) continue;
      // Full-day activities require an essentially free day (evening may remain)
      if (fullDay && freeMinutes(date) < dur + GAP) continue;
      const start = findSlot(date, dur, wins);
      if (start == null) continue;

      dayBusy.get(date)!.push({ start, end: start + dur });
      const dayName = new Date(date + 'T12:00:00').toLocaleDateString('he-IL', {
        weekday: 'long',
      });
      const reason = fullDay
        ? `פעילות ליום שלם — שובץ ל${dayName} (יום חלש בעומס)`
        : a.must > 0
          ? `MUST מהקבוצה · ציון ${a.score}`
          : a.score >= 5
            ? `דירוג גבוה (ציון ${a.score})`
            : `שובץ בחלון פתוח`;
      slots.push({
        activityId: a.id,
        title: a.name,
        date,
        startMinute: start,
        durationMins: dur,
        allDay: false,
        color: a.color || 'blue',
        mapsUrl: a.mapsUrl || null,
        cost: a.cost || null,
        notes: reason,
        reason,
      });
      placed.add(a.id);
      bumpRegion(date, a);
      return true;
    }
    return false;
  }

  // Pass 0: full-day anchors first (theme parks / long tours need an empty day)
  for (const a of toPlace.filter((x) => isFullDayActivity(x))) {
    placeActivity(a);
  }
  // Pass 1: MUST (force)
  for (const a of toPlace.filter((x) => x.must > 0)) {
    placeActivity(a);
  }
  // Pass 2: top scores
  for (const a of toPlace.filter((x) => x.must === 0)) {
    placeActivity(a);
  }
  // Pass 2.5: theme park fallback — if weekdays were full, allow weekend with a crowd warning
  for (const a of toPlace.filter((x) => isThemePark(x) && !placed.has(x.id))) {
    const dur = Math.max(8 * 60, Math.min(9 * 60 + 30, a.durationMins || 9 * 60));
    const weekendDays = [...days]
      .filter((d) => !travelDays.has(d)) // never on a flight day
      .sort((d1, d2) => freeMinutes(d2) - freeMinutes(d1));
    for (const date of weekendDays) {
      if (freeMinutes(date) < dur + GAP) continue;
      const start = findSlot(date, dur, [{ start: 9 * 60, end: 18 * 60 + 30 }]);
      if (start == null) continue;
      dayBusy.get(date)!.push({ start, end: start + dur });
      const note = 'שימו לב: שובץ בסוף שבוע — צפוי עומס בפארק, מומלץ להגיע בפתיחה';
      slots.push({
        activityId: a.id,
        title: a.name,
        date,
        startMinute: start,
        durationMins: dur,
        allDay: false,
        color: a.color || 'blue',
        mapsUrl: a.mapsUrl || null,
        cost: a.cost || null,
        notes: note,
        reason: note,
      });
      placed.add(a.id);
      bumpRegion(date, a);
      break;
    }
  }
  // Pass 3: fill days until full — no blank gaps as long as there are activities left.
  // Repeatedly target the emptiest day; prefer activities from the same area as that day.
  {
    let progress = true;
    while (progress) {
      progress = false;
      const remaining = eligible.filter(
        (a) => !placed.has(a.id) && !isLodging(a) && !isFullDayActivity(a),
      );
      if (!remaining.length) break;
      const byEmptiest = [...days].sort((d1, d2) => freeMinutes(d2) - freeMinutes(d1));
      for (const date of byEmptiest) {
        if (freeMinutes(date) < 90) continue; // day is already packed
        const hit = remaining
          .slice()
          .sort((x, y) => regionScore(date, x) - regionScore(date, y))
          .find((a) => placeActivity(a, [date]));
        if (hit) {
          progress = true;
          break;
        }
      }
    }
  }

  // Pass 4: if absolute top score still missing — force-place (never drop #1 vote)
  const top1 = [...eligible].sort((a, b) => b.score - a.score || b.must - a.must)[0];
  if (top1 && !placed.has(top1.id) && !isLodging(top1)) {
    for (const date of days) {
      // full-day favorites (e.g. theme park) never land on a flight day
      if (isFullDayActivity(top1) && travelDays.has(date)) continue;
      // never mix far-apart areas even when force-placing
      if (regionScore(date, top1) >= REGION_BLOCK) continue;
      const dow = new Date(date + 'T12:00:00').getDay();
      // widen window as last resort (still not midnight)
      const wins =
        windowsFor(top1, dow).length > 0
          ? windowsFor(top1, dow)
          : [{ start: 10 * 60, end: 18 * 60 }];
      const dur = Math.max(45, Math.min(6 * 60, top1.durationMins || 90));
      const start = findSlot(date, dur, wins);
      if (start == null) continue;
      dayBusy.get(date)!.push({ start, end: start + dur });
      slots.push({
        activityId: top1.id,
        title: top1.name,
        date,
        startMinute: start,
        durationMins: dur,
        color: top1.color || 'blue',
        mapsUrl: top1.mapsUrl || null,
        cost: top1.cost || null,
        notes: 'דירוג #1 מההצבעות — שובץ חובה',
        reason: 'דירוג #1 מההצבעות — שובץ חובה',
      });
      placed.add(top1.id);
      break;
    }
  }

  const skipped = eligible
    .filter((a) => !placed.has(a.id))
    .map((a) => ({
      activityId: a.id,
      name: a.name,
      reason:
        a.against > a.must + a.ok
          ? 'יותר מדי AGAINST'
          : 'לא נמצא יום מתאים (חלונות פתיחה / ריחוק גיאוגרפי מהימים הקיימים)',
    }));

  // Short AI summary only (placement is already done)
  let summaryHe = `שובצו ${slots.length} פעילויות לפי הצבעות הקבוצה (כולל כל ה-MUST). הלוח ממלא חלונות פתיחה סבירים ומונע חפיפות.`;
  try {
    const topNames = slots
      .slice()
      .sort((a, b) => {
        const sa = eligible.find((x) => x.id === a.activityId)?.score ?? 0;
        const sb = eligible.find((x) => x.id === b.activityId)?.score ?? 0;
        return sb - sa;
      })
      .slice(0, 5)
      .map((s) => s.title)
      .join(', ');
    const text = await completeText(
      'ענה בעברית בלבד: בדיוק שני משפטים קצרים על סידור הטיול. בלי כותרות, בלי markdown, בלי רשימות, בלי JSON.',
      `טיול ${opts.tripName}, ${days.length} ימים, ${slots.length} פעילויות. מובילים בהצבעות: ${topNames}. ${skipped.length} לא שובצו.`,
      180,
      'ai_schedule',
    );
    if (text) {
      summaryHe = text
        .replace(/[#*_`>-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
    }
  } catch {
    /* keep default summary */
  }

  return {
    slots: slots.sort(
      (a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute,
    ),
    summaryHe,
    skipped: skipped.slice(0, 40),
  };
}

function listDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const d = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  if (Number.isNaN(d.getTime()) || Number.isNaN(end.getTime()) || d > end) return days;
  while (d <= end) {
    days.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// ─── Place enrichment ─────────────────────────────────────────────────────────

/** Generate a Hebrew description for a place from Google Places data */
export async function generatePlaceDescription(opts: {
  name: string;
  location?: string | null;
  types?: string[];
  rating?: number | null;
}): Promise<string | null> {
  const { name, location, types, rating } = opts;

  const system = `אתה כותב תיאורים קצרים (1-2 משפטים) של מקומות לאפליקציית טיולים.
התיאור צריך להיות בעברית, אינפורמטיבי ומעניין.
ציין מה המקום, למה הוא שווה ביקור, וטיפ מעשי אחד (שעות פתיחה מומלצות, להזמין מראש, וכו').
התשובה חייבת להיות רק התיאור עצמו, ללא כותרות או עיטורים.`;

  const typesStr = types?.length ? types.slice(0, 5).join(', ') : 'לא ידוע';
  const ratingStr = rating ? `דירוג: ${rating}/5` : '';
  const locationStr = location ? `מיקום: ${location}` : '';

  const user = `שם: ${name}
${locationStr}
סוג: ${typesStr}
${ratingStr}

כתוב תיאור קצר (1-2 משפטים) בעברית:`;

  return completeText(system, user, 200, 'place_description');
}

export { completeText };
