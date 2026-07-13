import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { findOrCreateTripItem, serializeActivity, serializeEvent, updateTripItem } from '../lib/tripItems';
import {
  checkEventOpeningHours,
  checkEventsOpeningHoursFast,
  type ScheduleWarning,
  worstSeverity,
} from '../services/openingHours.service';
import {
  notifyTripMembers,
  createNotification,
  clearHoursNotificationsForEvent,
  purgeStaleHoursNotifications,
} from '../services/notifications.service';

const checkMember = (tripId: string, userId: string) =>
  prisma.tripMember.findUnique({ where: { userId_tripId: { userId, tripId } } });

/** Load activity only if it belongs to this trip (prevents cross-trip place leakage). */
async function getTripActivity(tripId: string, activityId: string | null | undefined) {
  if (!activityId) return null;
  return prisma.plannerActivity.findFirst({
    where: { id: activityId, tripId },
    include: { item: true },
  });
}

async function resolveEventMeta(event: {
  title: string;
  tripId?: string;
  activityId?: string | null;
  mapsUrl?: string | null;
  item?: any;
}) {
  let category: string | null = event.item?.category ?? null;
  let location: string | null = event.item?.location ?? null;
  let mapsUrl: string | null = event.item?.mapsUrl ?? event.mapsUrl ?? null;
  let name: string | null = event.item?.name ?? event.title;

  if (event.activityId) {
    const act = event.tripId
      ? await getTripActivity(event.tripId, event.activityId)
      : await prisma.plannerActivity.findUnique({
          where: { id: event.activityId },
          include: { item: true },
        });
    if (act) {
      category = act.item?.category ?? act.category ?? category;
      location = act.item?.location ?? act.location ?? location;
      mapsUrl = act.item?.mapsUrl ?? act.mapsUrl ?? mapsUrl;
      name = act.item?.name ?? act.name ?? name;
    }
  }
  return { category, location, mapsUrl, name };
}

async function warningsForEvent(event: {
  id?: string;
  tripId?: string;
  title: string;
  date: string;
  startMinute: number;
  durationMins: number;
  allDay?: boolean | null;
  activityId?: string | null;
  mapsUrl?: string | null;
  category?: string | null;
  location?: string | null;
  item?: any;
}): Promise<ScheduleWarning[]> {
  const meta = await resolveEventMeta(event);
  return checkEventOpeningHours({
    title: event.title,
    date: event.date,
    startMinute: Number(event.startMinute) || 0,
    durationMins: Number(event.durationMins) || 60,
    allDay: Boolean(event.allDay),
    category: event.category || meta.category,
    mapsUrl: event.mapsUrl || meta.mapsUrl,
    location: event.location || meta.location,
    name: meta.name || event.title,
  });
}

async function notifyScheduleWarnings(
  tripId: string,
  actorUserId: string,
  event: { id: string; title: string; date: string; startMinute?: number; allDay?: boolean },
  warnings: ScheduleWarning[],
) {
  // Never notify for all-day items (they intentionally coexist with timed events)
  if (event.allDay) {
    await clearHoursNotificationsForEvent(tripId, event.id);
    return;
  }

  // Only critical closed-time alerts — soft "check hours" tips become smart-notification noise
  const critical = warnings.filter((w) => w.severity === 'critical');
  // Always drop previous closed alerts for this event first (time may have changed)
  await clearHoursNotificationsForEvent(tripId, event.id);
  if (!critical.length) return;

  const top = critical[0];
  const isRestaurantClosed =
    top.code === 'RESTAURANT_CLOSED' || top.code === 'RESTAURANT_LATE';
  const timeLabel =
    event.startMinute != null
      ? `${String(Math.floor(event.startMinute / 60)).padStart(2, '0')}:${String(event.startMinute % 60).padStart(2, '0')}`
      : '';

  const emoji = '🚫';
  const title = isRestaurantClosed
    ? `🚫 המסעדה סגורה · ${event.title}${timeLabel ? ` · ${timeLabel}` : ''}`
    : `סגור בזמן המתוכנן · ${event.title}`;
  const body = critical.map((w) => w.message).join(' · ');
  const href = `/trip/${tripId}/plan/schedule`;
  const tipId = `hours:${event.id}:${top.code}`;
  const meta = {
    tipId,
    eventId: event.id,
    warnings: critical,
    date: event.date,
    startMinute: event.startMinute ?? null,
    kind: isRestaurantClosed ? 'restaurant_closed' : 'hours_warning',
  };

  await createNotification({
    userId: actorUserId,
    tripId,
    type: 'system',
    title,
    body,
    emoji,
    href,
    metadata: meta as any,
  });

  // Critical → notify whole group
  await notifyTripMembers(
    tripId,
    {
      type: 'system',
      title,
      body,
      emoji,
      href,
      metadata: meta as any,
    },
    actorUserId,
  );
}

export const getPlanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }

    const [activities, events] = await Promise.all([
      prisma.plannerActivity.findMany({ where: { tripId }, orderBy: { createdAt: 'asc' }, include: { files: true, item: true } }),
      prisma.plannerEvent.findMany({ where: { tripId }, orderBy: [{ date: 'asc' }, { startMinute: 'asc' }], include: { files: true, item: true, activity: true } }),
    ]);

    const serialized = events.map(serializeEvent);
    // Fast path only — Google is used on create/update/check-hours (not on every load)
    const checkInputs = events.map((ev) => ({
      id: ev.id,
      title: ev.title,
      date: ev.date,
      startMinute: ev.startMinute,
      durationMins: ev.durationMins,
      allDay: Boolean(ev.allDay),
      category: (ev as any).activity?.category ?? ev.item?.category ?? null,
      mapsUrl: ev.item?.mapsUrl ?? ev.mapsUrl ?? (ev as any).activity?.mapsUrl ?? null,
      location: (ev as any).activity?.location ?? ev.item?.location ?? null,
      name: (ev as any).activity?.name ?? ev.item?.name ?? ev.title,
    }));
    const warningsById = checkEventsOpeningHoursFast(checkInputs);
    const eventsWithWarnings = serialized.map((ev: any) => ({
      ...ev,
      scheduleWarnings: warningsById[ev.id] || [],
      scheduleSeverity: worstSeverity(warningsById[ev.id] || []),
    }));

    res.json({
      activities: activities.map(serializeActivity),
      events: eventsWithWarnings,
      scheduleWarningCount: Object.keys(warningsById).length,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

/** POST /api/planner/:tripId/check-hours — live preview (Google + heuristics) */
export const checkHours = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    if (!(await checkMember(tripId, req.userId!))) {
      res.status(403).json({ error: 'אין גישה' });
      return;
    }
    const {
      title,
      date,
      startMinute,
      durationMins,
      allDay,
      activityId,
      mapsUrl,
      location,
      category,
      name,
    } = req.body || {};

    if (!title?.trim() || !date) {
      res.status(400).json({ error: 'חסרים title/date' });
      return;
    }

    let cat = category ?? null;
    let loc = location ?? null;
    let maps = mapsUrl ?? null;
    let nm = name ?? title;

    if (activityId) {
      const act = await getTripActivity(tripId, String(activityId));
      if (act) {
        cat = cat || act.item?.category || act.category;
        loc = loc || act.item?.location || act.location;
        maps = maps || act.item?.mapsUrl || act.mapsUrl;
        nm = act.item?.name || act.name || nm;
      }
    }

    const scheduleWarnings = await checkEventOpeningHours({
      title: String(title),
      date: String(date).slice(0, 10),
      startMinute: Number(startMinute) || 0,
      durationMins: Number(durationMins) || 60,
      allDay: Boolean(allDay),
      category: cat,
      mapsUrl: maps,
      location: loc,
      name: nm,
    });

    res.json({
      scheduleWarnings,
      scheduleSeverity: worstSeverity(scheduleWarnings),
      googleConfigured: Boolean(
        (await import('../config/env')).config.googleMapsKey,
      ),
    });
  } catch (err) {
    console.error('[planner] check-hours', err);
    res.status(500).json({ error: 'שגיאה בבדיקת שעות' });
  }
};

export const createActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const { name, emoji, location, description, durationMins, cost, category, mapsUrl, url, color } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'שם שדה חובה' }); return; }
    const item = await findOrCreateTripItem(tripId, { name, emoji, location, description, durationMins, cost, category, mapsUrl, url, color }, 'activity');
    const activity = await prisma.plannerActivity.create({
      data: { tripId, itemId: item.id, name: item.name, emoji: item.emoji || '📌', location: item.location || null, description: item.description || null, durationMins: item.durationMins ?? 60, cost: item.cost || null, category: item.category || 'other', mapsUrl: item.mapsUrl || null, url: item.url || null, color: item.color || 'blue' },
      include: { files: true, item: true },
    });
    res.status(201).json({ activity: serializeActivity(activity) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const bulkCreateActivities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const { activities } = req.body as { activities: any[] };
    if (!Array.isArray(activities) || activities.length === 0) { res.status(400).json({ error: 'invalid' }); return; }
    for (const a of activities) {
      if (!a.name?.trim()) continue;
      const item = await findOrCreateTripItem(tripId, a, 'activity');
      await prisma.plannerActivity.create({
        data: {
          tripId, itemId: item.id, name: item.name, emoji: item.emoji || '📌', location: item.location || null,
          description: item.description || null, durationMins: item.durationMins ?? 60,
          cost: item.cost || null, category: item.category || 'other', mapsUrl: item.mapsUrl || null, url: item.url || null, color: item.color || 'blue',
        },
      });
    }
    const all = await prisma.plannerActivity.findMany({ where: { tripId }, orderBy: { createdAt: 'asc' }, include: { files: true, item: true } });
    res.status(201).json({ activities: all.map(serializeActivity) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const updateActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, actId } = req.params as { tripId: string; actId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const { name, emoji, location, description, durationMins, cost, category, mapsUrl, url, color } = req.body;
    const existing = await prisma.plannerActivity.findFirst({ where: { id: actId, tripId } });
    if (!existing) { res.status(404).json({ error: 'פעילות לא נמצאה' }); return; }
    const item = await updateTripItem(existing.itemId, tripId, { name, emoji, location, description, durationMins, cost, category, mapsUrl, url, color }, 'activity');
    const activity = await prisma.plannerActivity.update({
      where: { id: actId },
      data: {
        itemId: item.id,
        name: item.name,
        emoji: item.emoji,
        location: item.location,
        description: item.description,
        durationMins: item.durationMins ?? durationMins ?? existing.durationMins,
        cost: item.cost,
        category: item.category,
        mapsUrl: item.mapsUrl,
        url: item.url,
        color: item.color,
      },
      include: { files: true, item: true },
    });
    res.json({ activity: serializeActivity(activity) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const deleteActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, actId } = req.params as { tripId: string; actId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const existing = await prisma.plannerActivity.findFirst({ where: { id: actId, tripId } });
    if (!existing) { res.status(404).json({ error: 'פעילות לא נמצאה' }); return; }
    await prisma.plannerActivity.delete({ where: { id: actId } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const uploadActivityFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, actId } = req.params as { tripId: string; actId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    if (!req.file) { res.status(400).json({ error: 'קובץ חסר' }); return; }
    const { assertCanUpload, recordStorageDelta, LimitError, limitErrorPayload } =
      await import('../services/limits.service');
    try {
      await assertCanUpload(req.userId!, req.file.size);
    } catch (err) {
      if (err instanceof LimitError) {
        try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
        res.status(err.status).json(limitErrorPayload(err));
        return;
      }
      throw err;
    }
    await recordStorageDelta(req.userId!, req.file.size);
    const file = await prisma.plannerActivityFile.create({
      data: { activityId: actId, filename: req.file.filename, originalName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size },
    });
    res.status(201).json({ file });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const deleteActivityFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, fileId } = req.params as { tripId: string; fileId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const file = await prisma.plannerActivityFile.findUnique({ where: { id: fileId } });
    if (!file) { res.status(404).json({ error: 'קובץ לא נמצא' }); return; }
    try { fs.unlinkSync(path.join('/home/dor/tripo/uploads/planner', file.filename)); } catch { /* ignore */ }
    await prisma.plannerActivityFile.delete({ where: { id: fileId } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const { activityId, title, date, startMinute, durationMins, color, notes, allDay, url, mapsUrl, cost, category, location } = req.body;
    if (!title?.trim() || !date) { res.status(400).json({ error: 'שדות חסרים' }); return; }
    // Only link activities that belong to this trip
    const activity = await getTripActivity(tripId, activityId || null);
    const item =
      activity?.item && activity.item.tripId === tripId
        ? activity.item
        : await findOrCreateTripItem(tripId, {
            name: title,
            description: notes,
            durationMins,
            color,
            url,
            mapsUrl,
            cost,
            category: category || activity?.category,
            location: location || activity?.location,
          }, 'event');
    const startMinNum = allDay ? 0 : Math.max(0, Math.min(1439, Number(startMinute) || 0));
    const durNum = Math.max(15, Number(durationMins) || item.durationMins || 60);
    const linkedActivityId = activity?.id ?? null;
    const event = await prisma.plannerEvent.create({
      data: {
        tripId,
        itemId: item.id,
        activityId: linkedActivityId,
        title: item.name,
        date: String(date).slice(0, 10),
        startMinute: startMinNum,
        durationMins: durNum,
        color: item.color || color || 'blue',
        notes: notes || null,
        allDay: Boolean(allDay),
        url: item.url || activity?.url || url || null,
        mapsUrl: item.mapsUrl || activity?.mapsUrl || mapsUrl || null,
        cost: item.cost || cost || null,
      },
      include: { files: true, item: true },
    });

    let scheduleWarnings: ScheduleWarning[] = [];
    try {
      scheduleWarnings = await warningsForEvent({
        tripId,
        title: event.title,
        date: event.date,
        startMinute: event.startMinute,
        durationMins: event.durationMins,
        allDay: event.allDay,
        activityId: linkedActivityId,
        mapsUrl: event.mapsUrl || activity?.mapsUrl || activity?.item?.mapsUrl || mapsUrl || null,
        category: category || activity?.category || activity?.item?.category || null,
        location: location || activity?.location || activity?.item?.location || null,
        item: event.item || activity?.item,
      });
      console.log(
        '[planner] hours check create',
        event.title,
        event.date,
        event.startMinute,
        '→',
        scheduleWarnings.map((w) => w.code).join(',') || 'ok',
      );
    } catch (err) {
      console.error('[planner] hours check failed on create:', err);
    }

    if (scheduleWarnings.length && !event.allDay) {
      try {
        await notifyScheduleWarnings(
          tripId,
          req.userId!,
          {
            id: event.id,
            title: event.title,
            date: event.date,
            startMinute: event.startMinute,
            allDay: event.allDay,
          },
          scheduleWarnings,
        );
      } catch (err) {
        console.error('[planner] hours notify failed on create:', err);
      }
    }

    // Auto-refresh smart notifications (dismiss resolved issues) in background
    (async () => {
      try {
        const { generateSmartNotificationsForUser } = await import('../services/notifications.service');
        const members = await prisma.tripMember.findMany({ where: { tripId }, select: { userId: true } });
        await Promise.all(members.map(m => generateSmartNotificationsForUser(tripId, m.userId)));
      } catch (err) {
        console.error('[planner] smart notification refresh failed:', err);
      }
    })();

    res.status(201).json({
      event: {
        ...serializeEvent(event),
        scheduleWarnings,
        scheduleSeverity: worstSeverity(scheduleWarnings),
      },
      scheduleWarnings,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, eventId } = req.params as { tripId: string; eventId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const { title, date, startMinute, durationMins, color, notes, allDay, url, mapsUrl, cost } = req.body;
    const existing = await prisma.plannerEvent.findFirst({ where: { id: eventId, tripId } });
    if (!existing) { res.status(404).json({ error: 'אירוע לא נמצא' }); return; }
    const item = (title !== undefined || url !== undefined || mapsUrl !== undefined || cost !== undefined || color !== undefined)
      ? await updateTripItem(existing.itemId, tripId, { name: title, durationMins, color, notes, url, mapsUrl, cost }, 'event')
      : existing.itemId ? await prisma.tripItem.findUnique({ where: { id: existing.itemId } }) : null;
    const event = await prisma.plannerEvent.update({
      where: { id: eventId },
      data: {
        ...(item && { itemId: item.id }),
        ...(title && { title: item?.name ?? title.trim() }),
        ...(date && { date }),
        ...(startMinute !== undefined && { startMinute }),
        ...(durationMins && { durationMins }),
        ...(color && { color: item?.color ?? color }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(allDay !== undefined && { allDay: Boolean(allDay) }),
        ...(url !== undefined && { url: item?.url ?? null }),
        ...(mapsUrl !== undefined && { mapsUrl: item?.mapsUrl ?? null }),
        ...(cost !== undefined && { cost: item?.cost ?? null }),
      },
      include: { files: true, item: true },
    });

    let scheduleWarnings: ScheduleWarning[] = [];
    try {
      scheduleWarnings = await warningsForEvent({ ...event, tripId });
    } catch (err) {
      console.error('[planner] hours check failed on update:', err);
    }

    // Always re-sync hours notifications with current schedule (clear stale / re-alert if needed)
    try {
      await notifyScheduleWarnings(
        tripId,
        req.userId!,
        {
          id: event.id,
          title: event.title,
          date: event.date,
          startMinute: event.startMinute,
          allDay: event.allDay,
        },
        scheduleWarnings,
      );
    } catch (err) {
      console.error('[planner] hours notify failed on update:', err);
    }

    // Auto-refresh smart notifications (dismiss resolved issues) in background
    (async () => {
      try {
        const { generateSmartNotificationsForUser } = await import('../services/notifications.service');
        const members = await prisma.tripMember.findMany({ where: { tripId }, select: { userId: true } });
        await Promise.all([
          purgeStaleHoursNotifications({ tripId }),
          ...members.map((m) => generateSmartNotificationsForUser(tripId, m.userId)),
        ]);
      } catch (err) {
        console.error('[planner] smart notification refresh failed:', err);
      }
    })();

    res.json({
      event: {
        ...serializeEvent(event),
        scheduleWarnings,
        scheduleSeverity: worstSeverity(scheduleWarnings),
      },
      scheduleWarnings,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, eventId } = req.params as { tripId: string; eventId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    await prisma.plannerEvent.delete({ where: { id: eventId } });
    await clearHoursNotificationsForEvent(tripId, eventId);

    // Auto-refresh smart notifications (dismiss resolved issues) in background
    (async () => {
      try {
        const { generateSmartNotificationsForUser } = await import('../services/notifications.service');
        const members = await prisma.tripMember.findMany({ where: { tripId }, select: { userId: true } });
        await Promise.all([
          purgeStaleHoursNotifications({ tripId }),
          ...members.map((m) => generateSmartNotificationsForUser(tripId, m.userId)),
        ]);
      } catch (err) {
        console.error('[planner] smart notification refresh failed:', err);
      }
    })();

    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const uploadEventFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, eventId } = req.params as { tripId: string; eventId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    if (!req.file) { res.status(400).json({ error: 'קובץ חסר' }); return; }
    const { assertCanUpload, recordStorageDelta, LimitError, limitErrorPayload } =
      await import('../services/limits.service');
    try {
      await assertCanUpload(req.userId!, req.file.size);
    } catch (err) {
      if (err instanceof LimitError) {
        try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
        res.status(err.status).json(limitErrorPayload(err));
        return;
      }
      throw err;
    }
    await recordStorageDelta(req.userId!, req.file.size);
    const file = await prisma.plannerEventFile.create({
      data: { eventId, filename: req.file.filename, originalName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size },
    });
    res.status(201).json({ file });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const deleteEventFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, fileId } = req.params as { tripId: string; fileId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const file = await prisma.plannerEventFile.findUnique({ where: { id: fileId } });
    if (!file) { res.status(404).json({ error: 'קובץ לא נמצא' }); return; }
    try { fs.unlinkSync(path.join('/home/dor/tripo/uploads/planner', file.filename)); } catch { /* ignore */ }
    await prisma.plannerEventFile.delete({ where: { id: fileId } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

// ─── Votes ────────────────────────────────────────────────────────────────────

const VALID_VOTES = new Set(['MUST', 'OK', 'IF_OTHERS', 'NOT_REALLY', 'AGAINST']);

export const getMyVotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const rows = await prisma.plannerActivityVote.findMany({ where: { tripId, userId: req.userId! } });
    const votes: Record<string, string> = {};
    for (const r of rows) votes[r.activityId] = r.vote;
    res.json({ votes });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const getVotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const rows = await prisma.plannerActivityVote.findMany({ where: { tripId } });
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map(r => r.userId))] } },
      select: { id: true, name: true, avatarUrl: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));
    const map: Record<string, {
      activityId: string;
      MUST: number; OK: number; IF_OTHERS: number; NOT_REALLY: number; AGAINST: number;
      voters: Record<string, Array<{ id: string; name: string; avatarUrl: string | null }>>;
    }> = {};
    for (const r of rows) {
      if (!map[r.activityId]) {
        map[r.activityId] = {
          activityId: r.activityId, MUST: 0, OK: 0, IF_OTHERS: 0, NOT_REALLY: 0, AGAINST: 0,
          voters: { MUST: [], OK: [], IF_OTHERS: [], NOT_REALLY: [], AGAINST: [] },
        };
      }
      if (VALID_VOTES.has(r.vote)) {
        (map[r.activityId] as any)[r.vote]++;
        const user = userMap.get(r.userId);
        map[r.activityId].voters[r.vote]?.push({
          id: r.userId,
          name: user?.name ?? 'משתמש לא ידוע',
          avatarUrl: user?.avatarUrl ?? null,
        });
      }
    }
    res.json({ votes: Object.values(map) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const submitVotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const { votes } = req.body as { votes: Array<{ activityId: string; vote: string }> };
    if (!Array.isArray(votes) || votes.length === 0) { res.status(400).json({ error: 'invalid' }); return; }
    await Promise.all(
      votes.filter(v => VALID_VOTES.has(v.vote)).map(({ activityId, vote }) =>
        prisma.plannerActivityVote.upsert({
          where: { activityId_userId: { activityId, userId: req.userId! } },
          update: { vote },
          create: { activityId, tripId, userId: req.userId!, vote },
        })
      )
    );
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

// ─── AI schedule (preview → apply) ────────────────────────────────────────────

const VOTE_WEIGHT: Record<string, number> = {
  MUST: 5,
  OK: 3,
  IF_OTHERS: 1,
  NOT_REALLY: -1,
  AGAINST: -3,
};

/** POST /api/planner/:tripId/ai-schedule — generate draft only (no DB write) */
export const generateAiScheduleDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    const userId = req.userId!;
    if (!(await checkMember(tripId, userId))) {
      res.status(403).json({ error: 'אין גישה' });
      return;
    }

    const { assertCanUseAi, LimitError, limitErrorPayload, recordAiCall } =
      await import('../services/limits.service');
    const { isAiConfigured, generateAiSchedule } = await import('../services/ai.service');

    try {
      await assertCanUseAi(userId, tripId);
    } catch (err) {
      if (err instanceof LimitError) {
        res.status(err.status).json(limitErrorPayload(err));
        return;
      }
      throw err;
    }

    if (!isAiConfigured()) {
      res.status(503).json({ error: 'אין מפתח AI בשרת (OpenAI/Anthropic)' });
      return;
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip?.startDate || !trip?.endDate) {
      res.status(400).json({
        error: 'יש להגדיר תאריכי התחלה וסיום לטיול לפני סידור AI',
      });
      return;
    }

    const startDate = trip.startDate.toISOString().slice(0, 10);
    const endDate = trip.endDate.toISOString().slice(0, 10);

    const [activities, voteRows, existingEvents, flightRows] = await Promise.all([
      prisma.plannerActivity.findMany({ where: { tripId }, orderBy: { createdAt: 'asc' } }),
      prisma.plannerActivityVote.findMany({ where: { tripId } }),
      prisma.plannerEvent.findMany({
        where: { tripId },
        select: { date: true, startMinute: true, durationMins: true, title: true, allDay: true },
      }),
      prisma.tripFlight.findMany({
        where: { tripId },
        select: { direction: true, departureAt: true, arrivalAt: true, flightDate: true },
      }),
    ]);

    // Convert flights into blocked windows on their days (airport time, checkin, transit)
    const toDateMin = (d: Date | null) => {
      if (!d) return null;
      const iso = d.toISOString();
      return { date: iso.slice(0, 10), minute: Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)) };
    };
    const flightBlocks: Array<{ date: string; start: number; end: number }> = [];
    for (const f of flightRows) {
      const dep = toDateMin(f.departureAt);
      const arr = toDateMin(f.arrivalAt);
      const dir = (f.direction || 'outbound').toLowerCase();
      if (dir === 'return') {
        // Leaving the destination: day is blocked from ~3.5h before departure
        const start = dep ? Math.max(0, dep.minute - 210) : arr ? Math.max(0, arr.minute - 390) : 0;
        const date = dep?.date || arr?.date || (f.flightDate ? f.flightDate.toISOString().slice(0, 10) : null);
        if (date) flightBlocks.push({ date, start, end: 1440 });
      } else if (dir === 'outbound') {
        // Arriving at the destination: blocked until ~1.5h after landing
        const end = arr ? Math.min(1440, arr.minute + 90) : dep ? Math.min(1440, dep.minute + 300) : 1440;
        const date = arr?.date || dep?.date || (f.flightDate ? f.flightDate.toISOString().slice(0, 10) : null);
        if (date) flightBlocks.push({ date, start: 0, end });
      } else if (dep) {
        // Mid-trip flight: block around the flight itself
        const end = arr && arr.date === dep.date ? Math.min(1440, arr.minute + 90) : Math.min(1440, dep.minute + 300);
        flightBlocks.push({ date: dep.date, start: Math.max(0, dep.minute - 150), end });
      }
    }

    if (activities.length === 0) {
      res.status(400).json({ error: 'אין פעילויות בבנק — הוסיפו פעילויות והצביעו קודם' });
      return;
    }

    const voteAgg = new Map<
      string,
      { must: number; ok: number; against: number; score: number; total: number }
    >();
    for (const v of voteRows) {
      if (!voteAgg.has(v.activityId)) {
        voteAgg.set(v.activityId, { must: 0, ok: 0, against: 0, score: 0, total: 0 });
      }
      const a = voteAgg.get(v.activityId)!;
      a.total += 1;
      a.score += VOTE_WEIGHT[v.vote] ?? 0;
      if (v.vote === 'MUST') a.must += 1;
      if (v.vote === 'OK') a.ok += 1;
      if (v.vote === 'AGAINST') a.against += 1;
    }

    // If no votes yet, still schedule all activities with neutral score
    const inputs = activities.map((act) => {
      const v = voteAgg.get(act.id) || { must: 0, ok: 0, against: 0, score: 0, total: 0 };
      return {
        id: act.id,
        name: act.name,
        emoji: act.emoji,
        category: act.category,
        durationMins: act.durationMins || 60,
        location: act.location,
        mapsUrl: act.mapsUrl,
        color: act.color,
        cost: act.cost,
        score: v.total > 0 ? v.score : 1,
        must: v.must,
        ok: v.ok,
        against: v.against,
        totalVotes: v.total,
      };
    });

    await recordAiCall(userId, 1);

    const result = await generateAiSchedule({
      tripName: trip.name,
      startDate,
      endDate,
      activities: inputs,
      existingBusy: existingEvents
        .filter((e) => !e.allDay)
        .map((e) => ({
          date: e.date,
          startMinute: e.startMinute,
          durationMins: e.durationMins,
          title: e.title,
        })),
      flightBlocks,
    });

    if (!result?.slots?.length) {
      res.status(502).json({
        error: 'ה-AI לא הצליח לבנות לוח — נסו שוב או ודאו שיש הצבעות/תאריכים',
      });
      return;
    }

    // Fast hours hints only (heuristics) — full Google per-slot was timing out nginx (~60s)
    const { checkEventsOpeningHoursFast } = await import('../services/openingHours.service');
    const hoursMap = checkEventsOpeningHoursFast(
      result.slots.map((slot) => {
        const act = activities.find((a) => a.id === slot.activityId);
        return {
          id: `${slot.activityId}-${slot.date}-${slot.startMinute}`,
          title: slot.title,
          date: slot.date,
          startMinute: slot.startMinute,
          durationMins: slot.durationMins,
          allDay: slot.allDay,
          category: act?.category,
          mapsUrl: slot.mapsUrl || act?.mapsUrl,
          location: act?.location,
          name: slot.title,
        };
      }),
    );

    const slotsWithWarnings = result.slots.map((slot) => {
      const key = `${slot.activityId}-${slot.date}-${slot.startMinute}`;
      const scheduleWarnings = hoursMap[key] || [];
      return {
        ...slot,
        tempId: `draft-${slot.activityId}-${slot.date}-${slot.startMinute}`,
        scheduleWarnings,
        scheduleSeverity: scheduleWarnings.some((w) => w.severity === 'critical')
          ? 'critical'
          : scheduleWarnings.length
            ? 'warn'
            : null,
      };
    });

    res.json({
      draft: true,
      summaryHe: result.summaryHe,
      skipped: result.skipped,
      slots: slotsWithWarnings,
      trip: { id: tripId, name: trip.name, startDate, endDate },
      voteStats: {
        activities: activities.length,
        withVotes: [...voteAgg.values()].filter((v) => v.total > 0).length,
        totalVoteRows: voteRows.length,
      },
    });
  } catch (err) {
    console.error('[planner] ai-schedule generate', err);
    res.status(500).json({ error: 'שגיאה ביצירת לוח AI' });
  }
};

/** POST /api/planner/:tripId/ai-schedule/apply — commit draft slots to DB */
export const applyAiSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    const userId = req.userId!;
    if (!(await checkMember(tripId, userId))) {
      res.status(403).json({ error: 'אין גישה' });
      return;
    }

    const { slots, replaceTimed } = req.body as {
      slots: Array<{
        activityId: string;
        title?: string;
        date: string;
        startMinute: number;
        durationMins: number;
        allDay?: boolean;
        color?: string;
        notes?: string | null;
        mapsUrl?: string | null;
        url?: string | null;
        cost?: string | null;
      }>;
      /** If true, delete existing non-all-day events first */
      replaceTimed?: boolean;
    };

    if (!Array.isArray(slots) || slots.length === 0) {
      res.status(400).json({ error: 'אין אירועים לאישור' });
      return;
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      res.status(404).json({ error: 'טיול לא נמצא' });
      return;
    }

    if (replaceTimed !== false) {
      // Default: replace timed schedule so OK = full AI plan
      await prisma.plannerEvent.deleteMany({
        where: { tripId, allDay: false },
      });
    }

    const activityIds = [...new Set(slots.map((s) => s.activityId).filter(Boolean))];
    const acts = await prisma.plannerActivity.findMany({
      where: { tripId, id: { in: activityIds } },
      include: { item: true },
    });
    const actMap = new Map(acts.map((a) => [a.id, a]));

    const created = [];
    for (const s of slots) {
      const act = actMap.get(s.activityId);
      if (!act) continue;
      const allDay = Boolean(s.allDay);
      const date = String(s.date).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

      const item =
        act.item ||
        (await findOrCreateTripItem(
          tripId,
          {
            name: act.name,
            durationMins: act.durationMins,
            color: act.color,
            mapsUrl: act.mapsUrl,
            url: act.url,
            cost: act.cost,
            category: act.category,
            location: act.location,
            emoji: act.emoji,
          },
          'event',
        ));

      const event = await prisma.plannerEvent.create({
        data: {
          tripId,
          itemId: item.id,
          activityId: act.id,
          title: act.name,
          date,
          startMinute: allDay ? 0 : Math.max(0, Math.min(1439, Number(s.startMinute) || 0)),
          durationMins: allDay
            ? 1440
            : Math.max(15, Number(s.durationMins) || act.durationMins || 60),
          color: act.color || s.color || 'blue',
          notes: s.notes || null,
          allDay,
          url: act.url || null,
          mapsUrl: act.mapsUrl || s.mapsUrl || null,
          cost: act.cost || s.cost || null,
        },
        include: { files: true, item: true },
      });
      created.push(serializeEvent(event));
    }

    // Return full planner state
    const [allActs, allEvents] = await Promise.all([
      prisma.plannerActivity.findMany({
        where: { tripId },
        orderBy: { createdAt: 'asc' },
        include: { files: true, item: true },
      }),
      prisma.plannerEvent.findMany({
        where: { tripId },
        orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
        include: { files: true, item: true, activity: true },
      }),
    ]);

    res.json({
      ok: true,
      created: created.length,
      activities: allActs.map(serializeActivity),
      events: allEvents.map(serializeEvent),
    });
  } catch (err) {
    console.error('[planner] ai-schedule apply', err);
    res.status(500).json({ error: 'שגיאה באישור לוח AI' });
  }
};
