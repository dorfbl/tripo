import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isAiAllowedForTrip } from './ai.service';
import { polishNotificationTips } from './ai.service';
import { buildAssistantTips, type AssistantTip } from './assistant.service';

export interface CreateNotificationInput {
  userId: string;
  tripId?: string | null;
  type?: string;
  title: string;
  body?: string | null;
  emoji?: string;
  href?: string | null;
  aiGenerated?: boolean;
  metadata?: Prisma.InputJsonValue;
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      tripId: input.tripId || null,
      type: input.type || 'system',
      title: input.title.trim(),
      body: input.body?.trim() || null,
      emoji: input.emoji || '🔔',
      href: input.href || null,
      aiGenerated: Boolean(input.aiGenerated),
      metadata: input.metadata ?? undefined,
    },
  });
}

/** Notify all trip members (except optional skip user) */
export async function notifyTripMembers(
  tripId: string,
  payload: Omit<CreateNotificationInput, 'userId' | 'tripId'>,
  exceptUserId?: string | null,
) {
  try {
    const members = await prisma.tripMember.findMany({
      where: { tripId },
      select: { userId: true },
    });
    const targets = members.filter((m) => m.userId !== exceptUserId);
    await Promise.all(
      targets.map((m) =>
        createNotification({
          ...payload,
          userId: m.userId,
          tripId,
        }),
      ),
    );
  } catch (err) {
    console.error('[notifications] notifyTripMembers failed:', err);
  }
}

function parseHhMmToMinute(text: string): number | null {
  const m = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function isHoursNotifMeta(meta: any): boolean {
  if (!meta || typeof meta !== 'object') return false;
  if (meta.kind === 'hours_warning' || meta.kind === 'restaurant_closed') return true;
  if (typeof meta.tipId === 'string' && meta.tipId.startsWith('hours:')) return true;
  return false;
}

/**
 * Delete closed-hours notifications that no longer apply:
 * - event deleted
 * - event date/time changed since the alert was created
 * - place is open at the current scheduled time
 */
export async function purgeStaleHoursNotifications(opts: {
  tripId: string;
  userId?: string;
}): Promise<number> {
  const { tripId, userId } = opts;
  try {
    const rows = await prisma.notification.findMany({
      where: {
        tripId,
        ...(userId ? { userId } : {}),
      },
      select: { id: true, title: true, body: true, metadata: true, userId: true },
      orderBy: { createdAt: 'desc' },
      take: 400,
    });

    const hoursRows = rows.filter((n) => isHoursNotifMeta(n.metadata));
    if (!hoursRows.length) return 0;

    const eventIds = [
      ...new Set(
        hoursRows
          .map((n) => {
            const meta = n.metadata as any;
            if (meta?.eventId) return String(meta.eventId);
            const tip = String(meta?.tipId || '');
            const m = tip.match(/^hours:([^:]+):/);
            return m?.[1] || null;
          })
          .filter(Boolean) as string[],
      ),
    ];

    const events = eventIds.length
      ? await prisma.scheduledEvent.findMany({
          where: { id: { in: eventIds }, tripId },
          include: { place: true },
        })
      : [];
    const byId = new Map(events.map((e) => [e.id, e]));

    const { checkEventOpeningHours } = await import('./openingHours.service');
    const stillCritical = new Map<string, boolean>();
    const toDelete: string[] = [];

    for (const n of hoursRows) {
      const meta = n.metadata as any;
      const eventId =
        (meta?.eventId && String(meta.eventId)) ||
        (typeof meta?.tipId === 'string' && meta.tipId.match(/^hours:([^:]+):/)?.[1]) ||
        null;

      if (!eventId) {
        toDelete.push(n.id);
        continue;
      }

      const ev = byId.get(eventId);
      if (!ev || ev.allDay) {
        toDelete.push(n.id);
        continue;
      }

      // Alert is stale if it refers to a different date/time than current schedule
      const metaDate = meta?.date ? String(meta.date).slice(0, 10) : null;
      const metaStart =
        meta?.startMinute != null && meta.startMinute !== ''
          ? Number(meta.startMinute)
          : parseHhMmToMinute(`${n.title} ${n.body || ''}`);

      if (metaDate && metaDate !== ev.date) {
        toDelete.push(n.id);
        continue;
      }
      if (metaStart != null && !Number.isNaN(metaStart) && metaStart !== Number(ev.startMinute)) {
        toDelete.push(n.id);
        continue;
      }

      // Re-validate against current hours (cache per event)
      if (!stillCritical.has(eventId)) {
        try {
          const act = (ev as any).place;
          const warnings = await checkEventOpeningHours({
            title: ev.title || act?.name || '',
            date: ev.date,
            startMinute: ev.startMinute,
            durationMins: ev.durationMins,
            allDay: Boolean(ev.allDay),
            category: act?.category ?? null,
            mapsUrl: act?.mapsUrl ?? null,
            location: act?.location ?? null,
            name: act?.name ?? ev.title ?? '',
          });
          stillCritical.set(
            eventId,
            warnings.some((w) => w.severity === 'critical'),
          );
        } catch {
          // On check failure keep notification (safer)
          stillCritical.set(eventId, true);
        }
      }
      if (!stillCritical.get(eventId)) {
        toDelete.push(n.id);
      }
    }

    if (!toDelete.length) return 0;
    await prisma.notification.deleteMany({ where: { id: { in: toDelete } } });
    console.log(
      `[notifications] purged ${toDelete.length} stale hours notifications for trip ${tripId}`,
    );
    return toDelete.length;
  } catch (err) {
    console.error('[notifications] purgeStaleHoursNotifications failed:', err);
    return 0;
  }
}

/** Delete all hours-closed notifications for a planner event (any member). */
export async function clearHoursNotificationsForEvent(
  tripId: string,
  eventId: string,
): Promise<number> {
  try {
    const rows = await prisma.notification.findMany({
      where: { tripId },
      select: { id: true, metadata: true },
      take: 400,
      orderBy: { createdAt: 'desc' },
    });
    const ids = rows
      .filter((n) => {
        const meta = n.metadata as any;
        if (!isHoursNotifMeta(meta)) return false;
        if (meta?.eventId === eventId) return true;
        if (typeof meta?.tipId === 'string' && meta.tipId.startsWith(`hours:${eventId}:`)) {
          return true;
        }
        return false;
      })
      .map((n) => n.id);
    if (!ids.length) return 0;
    await prisma.notification.deleteMany({ where: { id: { in: ids } } });
    console.log(`[notifications] cleared ${ids.length} hours notifs for event ${eventId}`);
    return ids.length;
  } catch (err) {
    console.error('[notifications] clearHoursNotificationsForEvent failed:', err);
    return 0;
  }
}

function normalizeText(t: string): string {
  return (t || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Map a notification (or tip) to a stable smart key.
 * AI rewrites titles every run — so we match by meaning, not exact title.
 */
export function classifySmartKey(
  tipId: string | null | undefined,
  title: string,
  body?: string | null,
): string | null {
  if (tipId) {
    // normalize plural families
    const id = tipId.replace(/s$/, '');
    if (
      [
        'missing-hotel',
        'missing-flight-link',
        'open-decision', // open-decisions
        'activity-vote', // activity-votes
        'countdown',
        'hours-conflict',
        'schedule-overlap',
        'rain-tomorrow',
        'today-schedule',
        'empty-today',
        'no-expense-today',
      ].some((k) => id === k || id.startsWith(k))
    ) {
      if (id.startsWith('open-decision')) return 'open-decisions';
      if (id.startsWith('activity-vote')) return 'activity-votes';
      if (id.startsWith('hours-conflict')) return 'hours-conflict';
      if (id.startsWith('schedule-overlap')) return 'schedule-overlap';
      return id.startsWith('missing-hotel')
        ? 'missing-hotel'
        : id.startsWith('missing-flight')
          ? 'missing-flight-link'
          : tipId.replace(/s$/, '').startsWith('open-decision')
            ? 'open-decisions'
            : tipId;
    }
    // flight-* tips stay unique per flight
    if (tipId.startsWith('flight-')) return tipId;
    return tipId;
  }

  const text = normalizeText(`${title} ${body || ''}`);

  // Order matters — more specific first (AI rewrites titles constantly)

  // Countdown
  if (text.includes('ימים ליציאה') || text.includes('מחר יוצאים') || text.includes('ליציאה ל')) {
    return 'countdown';
  }

  // Hotel missing
  if (
    (text.includes('מלון') || text.includes('hotel')) &&
    (text.includes('חסר') ||
      text.includes('אין') ||
      text.includes('קישור') ||
      text.includes('פרטי') ||
      text.includes('אישור'))
  ) {
    return 'missing-hotel';
  }

  // Flight missing
  if (
    (text.includes('טיסה') || text.includes('flight')) &&
    (text.includes('חסר') || text.includes('אין') || text.includes('שמור'))
  ) {
    return 'missing-flight-link';
  }

  // Activity votes incomplete (must include activities)
  if (
    (text.includes('פעילו') || text.includes('activit')) &&
    (text.includes('הצבע') || text.includes('vote') || text.includes('ממתינ'))
  ) {
    return 'activity-votes';
  }

  // Open decisions
  if (
    text.includes('החלט') ||
    text.includes('הצבעות פתוח') ||
    text.includes('הצבעות ממתינ') ||
    text.includes('הצבעות בהצבע') ||
    (text.includes('הצבע') && (text.includes('פתוח') || text.includes('ממתינ') || text.includes('בהצבע')))
  ) {
    if (!text.includes('פעילו')) return 'open-decisions';
  }

  // Overlap (before generic "זמנים")
  if (text.includes('חפיפ') || text.includes('התנגש') || text.includes('overlap')) {
    return 'schedule-overlap';
  }

  // Hours closed — require strong closed wording, not just "בדקו"
  if (
    text.includes('סגור') ||
    text.includes('זמנים בעייתי') ||
    text.includes('שעות פתיחה') ||
    (text.includes('ייתכן ש') && text.includes('סגור'))
  ) {
    return 'hours-conflict';
  }

  return null;
}

/** Sticky tips: at most ONE per user+trip for the whole trip lifetime */
const STICKY_KEYS = new Set([
  'missing-hotel',
  'missing-flight-link',
  'open-decisions',
  'activity-votes',
  'countdown',
]);

/** Tips that may refresh but not more than once per N hours */
const COOLDOWN_HOURS: Record<string, number> = {
  'hours-conflict': 24,
  'schedule-overlap': 24,
  'rain-tomorrow': 12,
  'today-schedule': 8,
  'empty-today': 8,
  'no-expense-today': 8,
  default: 24,
};

/** In-process lock so concurrent POST /smart (e.g. React StrictMode) cannot double-insert */
const smartGenLocks = new Map<string, Promise<unknown>>();

async function withSmartGenLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = smartGenLocks.get(key) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const chained = prev.then(() => gate);
  smartGenLocks.set(key, chained);
  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (smartGenLocks.get(key) === chained) smartGenLocks.delete(key);
  }
}

/**
 * Keep only the newest notification per smartKey for a user+trip.
 * Fixes historical duplicates from concurrent smart generation.
 */
export async function purgeDuplicateSmartNotifications(opts: {
  tripId: string;
  userId: string;
}): Promise<number> {
  const { tripId, userId } = opts;
  try {
    const rows = await prisma.notification.findMany({
      where: { tripId, userId },
      select: { id: true, title: true, body: true, metadata: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });

    const seen = new Set<string>();
    const toDelete: string[] = [];
    for (const n of rows) {
      const meta = n.metadata as any;
      if (meta?.kind !== 'smart' && meta?.kind !== undefined) {
        // hours_warning / restaurant_closed handled elsewhere
        if (meta?.kind !== 'smart') continue;
      }
      const key =
        (meta?.smartKey as string) ||
        classifySmartKey(meta?.tipId, n.title, n.body) ||
        null;
      if (!key) continue;
      // Only dedupe sticky + known smart tip families
      const isSmartFamily =
        meta?.kind === 'smart' ||
        STICKY_KEYS.has(key) ||
        key.startsWith('schedule-overlap') ||
        key.startsWith('hours-conflict') ||
        key.startsWith('missing-');
      if (!isSmartFamily && meta?.kind !== 'smart') continue;

      if (seen.has(key)) {
        toDelete.push(n.id);
      } else {
        seen.add(key);
      }
    }

    if (!toDelete.length) return 0;
    await prisma.notification.deleteMany({ where: { id: { in: toDelete } } });
    console.log(
      `[notifications] purged ${toDelete.length} duplicate smart notifications user=${userId.slice(0, 6)} trip=${tripId.slice(0, 6)}`,
    );
    return toDelete.length;
  } catch (err) {
    console.error('[notifications] purgeDuplicateSmartNotifications failed:', err);
    return 0;
  }
}

/**
 * Generate AI (or rule-based) smart notifications for a user on a trip.
 * Dedupes aggressively by stable smartKey (survives AI title rewrites).
 * Auto-dismisses (marks as read) resolved notifications that are no longer issues.
 */
export async function generateSmartNotificationsForUser(
  tripId: string,
  userId: string,
): Promise<{ created: number; ai: boolean; skipped: number; dismissed: number }> {
  return withSmartGenLock(`${userId}:${tripId}`, () =>
    generateSmartNotificationsForUserUnlocked(tripId, userId),
  );
}

/**
 * Delete unread smart notifications whose underlying issue is no longer
 * present in the trip's current tips (e.g. rain warning after the forecast
 * changed, missing-hotel after a link was added).
 */
export async function purgeResolvedSmartNotifications(opts: {
  tripId: string;
  userId: string;
  tips?: AssistantTip[];
}): Promise<number> {
  const { tripId, userId } = opts;
  try {
    const tips = opts.tips ?? (await buildAssistantTips(tripId));

    const currentKeys = new Set<string>();
    for (const t of tips) {
      const key = classifySmartKey(t.id, t.title, t.body) || t.id;
      currentKeys.add(key);
    }

    const unreadSmart = await prisma.notification.findMany({
      where: { userId, tripId, isRead: false },
      select: { id: true, title: true, body: true, metadata: true },
    });

    const toResolve: string[] = [];
    for (const n of unreadSmart) {
      const meta = n.metadata as any;
      if (meta?.kind !== 'smart') continue; // only auto-dismiss smart notifications
      const key = (meta?.smartKey as string) || classifySmartKey(meta?.tipId, n.title, n.body);
      if (key && !currentKeys.has(key)) {
        toResolve.push(n.id);
      }
    }

    if (!toResolve.length) return 0;
    await prisma.notification.deleteMany({ where: { id: { in: toResolve } } });
    console.log(`[notifications] auto-deleted ${toResolve.length} resolved smart notifications`);
    return toResolve.length;
  } catch (err) {
    console.error('[notifications] purgeResolvedSmartNotifications failed:', err);
    return 0;
  }
}

async function generateSmartNotificationsForUserUnlocked(
  tripId: string,
  userId: string,
): Promise<{ created: number; ai: boolean; skipped: number; dismissed: number }> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, name: true, aiEnabled: true },
  });
  if (!trip) return { created: 0, ai: false, skipped: 0, dismissed: 0 };

  // Always drop hours-closed alerts that no longer match the current schedule
  let dismissed = await purgeStaleHoursNotifications({ tripId, userId });
  dismissed += await purgeDuplicateSmartNotifications({ tripId, userId });

  const tips = await buildAssistantTips(tripId);
  dismissed += await purgeResolvedSmartNotifications({ tripId, userId, tips });

  if (!tips.length) return { created: 0, ai: false, skipped: 0, dismissed };

  // Prefer actionable tips; still allow a couple of info if nothing else
  const meaningful = tips.filter((t) => t.severity === 'urgent' || t.severity === 'warn');
  const selected: AssistantTip[] = (
    meaningful.length ? meaningful : tips.filter((t) => t.severity === 'info').slice(0, 2)
  ).slice(0, 3);

  // Load ALL prior smart/system notifications for this user+trip (lifetime sticky dedupe)
  const prior = await prisma.notification.findMany({
    where: { userId, tripId },
    select: { title: true, body: true, metadata: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  type PriorHit = { key: string; at: Date };
  const priorKeys: PriorHit[] = [];
  for (const r of prior) {
    const meta = r.metadata as any;
    const key =
      (meta?.smartKey as string) ||
      classifySmartKey(meta?.tipId, r.title, r.body) ||
      null;
    if (key) priorKeys.push({ key, at: r.createdAt });
  }
  const latestByKey = new Map<string, Date>();
  for (const p of priorKeys) {
    if (!latestByKey.has(p.key)) latestByKey.set(p.key, p.at);
  }

  const now = Date.now();
  const allowedTips = selected.filter((t) => {
    const key = classifySmartKey(t.id, t.title, t.body) || t.id;
    const last = latestByKey.get(key);
    if (!last) return true;
    if (STICKY_KEYS.has(key)) {
      // already sent once for this trip — never again
      return false;
    }
    const hours = COOLDOWN_HOURS[key] ?? COOLDOWN_HOURS.default;
    return now - last.getTime() > hours * 60 * 60 * 1000;
  });

  if (!allowedTips.length) {
    return { created: 0, ai: false, skipped: selected.length, dismissed };
  }

  const aiOk = await isAiAllowedForTrip(tripId, userId);
  let drafts = allowedTips.map((t) => {
    const smartKey = classifySmartKey(t.id, t.title, t.body) || t.id;
    return {
      tipId: t.id,
      smartKey,
      title: t.title,
      body: t.body,
      emoji: t.emoji,
      type: t.severity === 'urgent' ? 'ai' : 'system',
      href: t.action?.path || `/trip/${tripId}/home`,
      aiGenerated: false,
    };
  });

  // Tips whose body must stay factual — never let AI rewrite (it invents hotel overlaps etc.)
  const NO_AI_REWRITE = new Set([
    'schedule-overlap',
    'schedule-overlaps',
    'hours-conflict',
    'hours-conflicts',
  ]);

  if (aiOk && allowedTips.length) {
    try {
      const polishable = allowedTips.filter((t) => !NO_AI_REWRITE.has(t.id));
      if (polishable.length) {
        const { recordAiCall } = await import('./limits.service');
        await recordAiCall(userId, 1);
        const polished = await polishNotificationTips(
          trip.name,
          polishable.map((t) => ({
            id: t.id,
            title: t.title,
            body: t.body,
            emoji: t.emoji,
          })),
        );
        if (polished?.length) {
          const byId = new Map(polishable.map((t, i) => [t.id, polished[i]]));
          drafts = drafts.map((d) => {
            if (NO_AI_REWRITE.has(d.tipId)) return d; // keep factual
            const p = byId.get(d.tipId);
            if (!p) return d;
            return {
              ...d,
              title: p.title || d.title,
              body: p.body || d.body,
              emoji: p.emoji || d.emoji,
              type: 'ai' as const,
              aiGenerated: true,
            };
          });
        }
      }
    } catch {
      // fall back to rule-based
    }
  }

  // Final pass: unique smartKeys only within this batch
  const seenBatch = new Set<string>();
  let created = 0;
  let skipped = selected.length - allowedTips.length;

  for (const d of drafts) {
    if (seenBatch.has(d.smartKey)) {
      skipped++;
      continue;
    }
    // Re-check sticky after AI (paranoia)
    const last = latestByKey.get(d.smartKey);
    if (last) {
      if (STICKY_KEYS.has(d.smartKey)) {
        skipped++;
        continue;
      }
      const hours = COOLDOWN_HOURS[d.smartKey] ?? COOLDOWN_HOURS.default;
      if (now - last.getTime() <= hours * 60 * 60 * 1000) {
        skipped++;
        continue;
      }
    }

    // Final DB re-check (another concurrent request may have inserted just now)
    try {
      const recent = await prisma.notification.findMany({
        where: { userId, tripId },
        select: { metadata: true, title: true, body: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      const already = recent.some((r) => {
        const meta = r.metadata as any;
        const key =
          (meta?.smartKey as string) ||
          classifySmartKey(meta?.tipId, r.title, r.body) ||
          null;
        if (key !== d.smartKey) return false;
        if (STICKY_KEYS.has(d.smartKey)) return true;
        const hours = COOLDOWN_HOURS[d.smartKey] ?? COOLDOWN_HOURS.default;
        return Date.now() - r.createdAt.getTime() <= hours * 60 * 60 * 1000;
      });
      if (already) {
        skipped++;
        seenBatch.add(d.smartKey);
        continue;
      }
    } catch {
      /* proceed */
    }

    await createNotification({
      userId,
      tripId,
      type: d.type,
      title: d.title,
      body: d.body,
      emoji: d.emoji,
      href: d.href,
      aiGenerated: d.aiGenerated,
      metadata: {
        tipId: d.tipId,
        smartKey: d.smartKey,
        kind: 'smart',
      } as any,
    });
    seenBatch.add(d.smartKey);
    latestByKey.set(d.smartKey, new Date());
    created++;
  }

  return { created, ai: aiOk, skipped, dismissed };
}
