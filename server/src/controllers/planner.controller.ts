import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
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

/** Load place (activity) only if it belongs to this trip (prevents cross-trip place leakage). */
async function getTripActivity(tripId: string, activityId: string | null | undefined) {
  if (!activityId) return null;
  // NEW SCHEMA: Query Place instead of PlannerActivity
  return prisma.place.findFirst({
    where: { id: activityId, tripId },
  });
}

/** One place = one scheduled day: drop the place's events on other days (map sync uses the same rule). */
async function removeOtherDayEventsForPlace(tripId: string, placeId: string, keepDate: string, excludeEventId?: string) {
  const stale = await prisma.scheduledEvent.findMany({
    where: {
      tripId,
      placeId,
      date: { not: keepDate },
      ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
    },
    select: { id: true },
  });
  for (const ev of stale) {
    await prisma.scheduledEvent.delete({ where: { id: ev.id } });
    try { await clearHoursNotificationsForEvent(tripId, ev.id); } catch { /* ignore */ }
  }
  return stale.length;
}

/** Serialize a Place row to the frontend "activity" shape. */
const serializePlaceAsActivity = (p: any) => ({
  id: p.id,
  tripId: p.tripId,
  name: p.name,
  nameOriginal: p.nameOriginal,
  emoji: p.emoji,
  location: p.location,
  description: p.description,
  durationMins: p.durationMins || 60,
  estimatedDuration: p.estimatedDuration,
  cost: p.cost,
  category: p.category,
  mapsUrl: p.mapsUrl,
  url: p.url,
  color: p.color,
  placeId: p.placeId,
  openingHours: p.openingHours,
  rating: p.rating,
  ratingCount: p.ratingCount,
  createdAt: p.createdAt,
  files: p.files ?? [],
  votes: p.votes ?? [],
  item: null, // No longer using TripItem
});

/** Serialize a ScheduledEvent (with place included) to the frontend "event" shape. */
const serializeScheduledEvent = (ev: any) => ({
  id: ev.id,
  tripId: ev.tripId,
  activityId: ev.placeId, // Map placeId to activityId for compatibility
  title: ev.title || ev.place?.name || '',
  date: ev.date,
  startMinute: ev.startMinute,
  durationMins: ev.durationMins,
  color: ev.color || ev.place?.color || 'blue',
  notes: ev.notes,
  allDay: ev.allDay,
  url: ev.place?.url || null,
  mapsUrl: ev.place?.mapsUrl || null,
  cost: ev.place?.cost || null,
  createdAt: ev.createdAt,
  updatedAt: ev.updatedAt,
  files: ev.files ?? [],
  activity: ev.place ? {
    id: ev.place.id,
    name: ev.place.name,
    category: ev.place.category,
    location: ev.place.location,
    mapsUrl: ev.place.mapsUrl,
  } : null,
});

async function resolveEventMeta(event: {
  title: string;
  tripId?: string;
  activityId?: string | null;
  placeId?: string | null;
  mapsUrl?: string | null;
  item?: any;
  place?: any;
}) {
  let category: string | null = event.item?.category ?? event.place?.category ?? null;
  let location: string | null = event.item?.location ?? event.place?.location ?? null;
  let mapsUrl: string | null = event.item?.mapsUrl ?? event.place?.mapsUrl ?? event.mapsUrl ?? null;
  let name: string | null = event.item?.name ?? event.place?.name ?? event.title;
  let openingHours: any = event.item?.openingHours ?? event.place?.openingHours ?? undefined;

  // Try both activityId (frontend) and placeId (database)
  const placeIdToFetch = event.activityId ?? event.placeId;

  if (placeIdToFetch && !event.place) {
    const place = event.tripId
      ? await getTripActivity(event.tripId, placeIdToFetch)
      : await prisma.place.findUnique({
          where: { id: placeIdToFetch },
        });
    if (place) {
      category = place.category ?? category;
      location = place.location ?? location;
      mapsUrl = place.mapsUrl ?? mapsUrl;
      name = place.name ?? name;
      openingHours = place.openingHours ?? openingHours;
    }
  }
  return { category, location, mapsUrl, name, openingHours };
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
    openingHours: meta.openingHours,
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

    // NEW SCHEMA: Query Place and ScheduledEvent
    const [places, events] = await Promise.all([
      prisma.place.findMany({
        where: { tripId },
        orderBy: { createdAt: 'asc' },
        include: { files: true, votes: true }
      }),
      prisma.scheduledEvent.findMany({
        where: { tripId },
        orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
        include: { files: true, place: true }
      }),
    ]);

    // Convert to old format with ALL Place fields from CSV
    const activities = places.map(serializePlaceAsActivity);

    const serializedEvents = events.map(serializeScheduledEvent);

    // Fast path only — Google is used on create/update/check-hours (not on every load)
    const checkInputs = events.map((ev) => ({
      id: ev.id,
      title: ev.title || ev.place?.name || '',
      date: ev.date,
      startMinute: ev.startMinute,
      durationMins: ev.durationMins,
      allDay: Boolean(ev.allDay),
      category: ev.place?.category ?? null,
      mapsUrl: ev.place?.mapsUrl ?? null,
      location: ev.place?.location ?? null,
      name: ev.place?.name ?? ev.title ?? '',
    }));
    const warningsById = checkEventsOpeningHoursFast(checkInputs);
    const eventsWithWarnings = serializedEvents.map((ev: any) => ({
      ...ev,
      scheduleWarnings: warningsById[ev.id] || [],
      scheduleSeverity: worstSeverity(warningsById[ev.id] || []),
    }));

    res.json({
      activities,
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
    const {
      nameOriginal,
      emoji,
      location,
      description,
      notes,
      durationMins,
      cost,
      category,
      mapsUrl,
      url,
      color,
      placeId,
      lat,
      lng,
      openingHours,
      rating,
      ratingCount,
      estimatedDuration,
      types,
    } = req.body;
    if (!nameOriginal?.trim()) { res.status(400).json({ error: 'שם שדה חובה' }); return; }

    // Generate Hebrew description if not provided (and we have placeId)
    let generatedDescription = description?.trim() || notes?.trim() || null;
    if (!generatedDescription && placeId) {
      const { generatePlaceDescription } = await import('../services/ai.service');
      try {
        const aiDesc = await generatePlaceDescription({
          name: nameOriginal.trim(),
          location: location?.trim() || null,
          types: types || [],
          rating: rating != null ? Number(rating) : null,
        });
        if (aiDesc) generatedDescription = aiDesc;
      } catch (err) {
        console.error('[createActivity] Failed to generate description:', err);
        // Continue without description — not critical
      }
    }

    // Parse duration from estimatedDuration if provided
    let durationMinutes = durationMins ?? 60;
    if (estimatedDuration && !durationMins) {
      const match = estimatedDuration.match(/(\d+)(?:-(\d+))?\s*שע/);
      if (match) {
        const min = parseInt(match[1], 10);
        const max = match[2] ? parseInt(match[2], 10) : min;
        durationMinutes = ((min + max) / 2) * 60;
      }
    }

    // NEW SCHEMA: Create Place directly with ALL fields from Google Places API
    const place = await prisma.place.create({
      data: {
        tripId,
        name: nameOriginal.trim(),
        nameOriginal: nameOriginal.trim(),
        emoji: emoji || '📌',
        location: location || null,
        description: generatedDescription,
        durationMins: durationMinutes,
        estimatedDuration: estimatedDuration || null,
        cost: cost || null,
        category: category || 'other',
        mapsUrl: mapsUrl || null,
        url: url || null,
        color: color || 'blue',
        placeId: placeId || null,
        lat: lat != null ? Number(lat) : null,
        lng: lng != null ? Number(lng) : null,
        openingHours: openingHours || null,
        rating: rating != null ? Number(rating) : null,
        ratingCount: ratingCount != null ? Number(ratingCount) : null,
      },
      include: { files: true, votes: true },
    });

    res.status(201).json({ activity: serializePlaceAsActivity(place) });
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
      await prisma.place.create({
        data: {
          tripId, name: a.name.trim(), nameOriginal: a.name.trim(), emoji: a.emoji || '📌', location: a.location || null,
          description: a.description || null, durationMins: a.durationMins ?? 60,
          cost: a.cost || null, category: a.category || 'other', mapsUrl: a.mapsUrl || null, url: a.url || null, color: a.color || 'blue',
        },
      });
    }
    const all = await prisma.place.findMany({ where: { tripId }, orderBy: { createdAt: 'asc' }, include: { files: true, votes: true } });
    res.status(201).json({ activities: all.map(serializePlaceAsActivity) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const updateActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, actId } = req.params as { tripId: string; actId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const { name, emoji, location, description, durationMins, cost, category, mapsUrl, url, color } = req.body;
    const existing = await prisma.place.findFirst({ where: { id: actId, tripId } });
    if (!existing) { res.status(404).json({ error: 'פעילות לא נמצאה' }); return; }
    const place = await prisma.place.update({
      where: { id: actId },
      data: {
        name: name?.trim() ? name.trim() : existing.name,
        emoji: emoji ?? existing.emoji,
        location: location !== undefined ? (location || null) : existing.location,
        description: description !== undefined ? (description || null) : existing.description,
        durationMins: durationMins != null ? Number(durationMins) : existing.durationMins,
        cost: cost !== undefined ? (cost || null) : existing.cost,
        category: category ?? existing.category,
        mapsUrl: mapsUrl !== undefined ? (mapsUrl || null) : existing.mapsUrl,
        url: url !== undefined ? (url || null) : existing.url,
        color: color ?? existing.color,
      },
      include: { files: true, votes: true },
    });
    res.json({ activity: serializePlaceAsActivity(place) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const deleteActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, actId } = req.params as { tripId: string; actId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const existing = await prisma.place.findFirst({ where: { id: actId, tripId } });
    if (!existing) { res.status(404).json({ error: 'פעילות לא נמצאה' }); return; }
    await prisma.place.delete({ where: { id: actId } });
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
    const file = await prisma.placeFile.create({
      data: { placeId: actId, filename: req.file.filename, originalName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size },
    });
    res.status(201).json({ file });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const deleteActivityFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, fileId } = req.params as { tripId: string; fileId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const file = await prisma.placeFile.findUnique({ where: { id: fileId } });
    if (!file) { res.status(404).json({ error: 'קובץ לא נמצא' }); return; }
    try { fs.unlinkSync(path.join('/home/dor/tripo/uploads/planner', file.filename)); } catch { /* ignore */ }
    await prisma.placeFile.delete({ where: { id: fileId } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const { activityId, title, date, startMinute, durationMins, color, notes, allDay, url, mapsUrl, cost, category, location } = req.body;
    if (!title?.trim() || !date) { res.status(400).json({ error: 'שדות חסרים' }); return; }

    // NEW SCHEMA: Get linked place (activity) if provided
    const place = await getTripActivity(tripId, activityId || null);

    const startMinNum = allDay ? 0 : Math.max(0, Math.min(1439, Number(startMinute) || 0));
    const durNum = Math.max(15, Number(durationMins) || place?.durationMins || 60);

    // NEW SCHEMA: Create ScheduledEvent
    const event = await prisma.scheduledEvent.create({
      data: {
        tripId,
        placeId: place?.id ?? null,
        title: title.trim(),
        date: String(date).slice(0, 10),
        startMinute: startMinNum,
        durationMins: durNum,
        color: color || place?.color || 'blue',
        notes: notes || null,
        allDay: Boolean(allDay),
      },
      include: { files: true, place: true },
    });

    // One place = one day: scheduling here removes the place's events on other days
    if (place) {
      try { await removeOtherDayEventsForPlace(tripId, place.id, event.date, event.id); } catch { /* ignore */ }
    }

    let scheduleWarnings: ScheduleWarning[] = [];
    try {
      scheduleWarnings = await warningsForEvent({
        tripId,
        title: event.title || '',
        date: event.date,
        startMinute: event.startMinute,
        durationMins: event.durationMins,
        allDay: event.allDay,
        activityId: place?.id ?? null,
        mapsUrl: place?.mapsUrl ?? null,
        category: place?.category ?? null,
        location: place?.location ?? null,
      });
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
            title: event.title || '',
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

    // Return in frontend-compatible format
    const serializedEvent = {
      id: event.id,
      tripId: event.tripId,
      activityId: event.placeId,
      title: event.title || place?.name || '',
      date: event.date,
      startMinute: event.startMinute,
      durationMins: event.durationMins,
      color: event.color || place?.color || 'blue',
      notes: event.notes,
      allDay: event.allDay,
      url: place?.url || null,
      mapsUrl: place?.mapsUrl || null,
      cost: place?.cost || null,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      files: event.files,
      activity: place ? {
        id: place.id,
        name: place.name,
        category: place.category,
        location: place.location,
        mapsUrl: place.mapsUrl,
      } : null,
      scheduleWarnings,
      scheduleSeverity: worstSeverity(scheduleWarnings),
    };

    res.status(201).json({
      event: serializedEvent,
      scheduleWarnings,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, eventId } = req.params as { tripId: string; eventId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const { title, date, startMinute, durationMins, color, notes, allDay } = req.body;

    // NEW SCHEMA: Query ScheduledEvent
    const existing = await prisma.scheduledEvent.findFirst({ where: { id: eventId, tripId } });
    if (!existing) { res.status(404).json({ error: 'אירוע לא נמצא' }); return; }

    // NEW SCHEMA: Update ScheduledEvent
    const event = await prisma.scheduledEvent.update({
      where: { id: eventId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(date && { date: String(date).slice(0, 10) }),
        ...(startMinute !== undefined && { startMinute: Number(startMinute) }),
        ...(durationMins !== undefined && { durationMins: Number(durationMins) }),
        ...(color && { color }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(allDay !== undefined && { allDay: Boolean(allDay) }),
      },
      include: { files: true, place: true },
    });

    // One place = one day: moving an event drags the place fully to the new day
    if (event.placeId) {
      try { await removeOtherDayEventsForPlace(tripId, event.placeId, event.date, event.id); } catch { /* ignore */ }
    }

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

    // Convert to old format for frontend compatibility
    const serialized = {
      id: event.id,
      tripId: event.tripId,
      activityId: event.placeId,
      title: event.title || event.place?.name || '',
      date: event.date,
      startMinute: event.startMinute,
      durationMins: event.durationMins,
      color: event.color,
      notes: event.notes,
      allDay: event.allDay,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      files: event.files,
      item: event.place ? {
        id: event.place.id,
        name: event.place.name,
        emoji: event.place.emoji,
        location: event.place.location,
        description: event.place.description,
        durationMins: event.place.durationMins || 60,
        cost: event.place.cost,
        category: event.place.category,
        mapsUrl: event.place.mapsUrl,
        url: event.place.url,
        color: event.place.color,
      } : null,
      scheduleWarnings,
      scheduleSeverity: worstSeverity(scheduleWarnings),
    };

    res.json({ event: serialized, scheduleWarnings });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, eventId } = req.params as { tripId: string; eventId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }

    // NEW SCHEMA: Delete ScheduledEvent
    await prisma.scheduledEvent.delete({ where: { id: eventId } });
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
    const file = await prisma.scheduledEventFile.create({
      data: { eventId, filename: req.file.filename, originalName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size },
    });
    res.status(201).json({ file });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const deleteEventFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, fileId } = req.params as { tripId: string; fileId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const file = await prisma.scheduledEventFile.findUnique({ where: { id: fileId } });
    if (!file) { res.status(404).json({ error: 'קובץ לא נמצא' }); return; }
    try { fs.unlinkSync(path.join('/home/dor/tripo/uploads/planner', file.filename)); } catch { /* ignore */ }
    await prisma.scheduledEventFile.delete({ where: { id: fileId } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

// ─── Votes ────────────────────────────────────────────────────────────────────

const VALID_VOTES = new Set(['MUST', 'OK', 'IF_OTHERS', 'NOT_REALLY', 'AGAINST']);

export const getMyVotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }

    // NEW SCHEMA: Use PlaceVote
    const rows = await prisma.placeVote.findMany({
      where: { tripId, userId: req.userId! }
    });

    const votes: Record<string, string> = {};
    for (const r of rows) votes[r.placeId] = r.vote; // Use placeId instead of activityId

    res.json({ votes });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const getVotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }

    // NEW SCHEMA: Use PlaceVote
    const rows = await prisma.placeVote.findMany({ where: { tripId } });
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map(r => r.userId))] } },
      select: { id: true, name: true, avatarUrl: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const map: Record<string, {
      activityId: string; // Keep as activityId for frontend compatibility
      MUST: number; OK: number; IF_OTHERS: number; NOT_REALLY: number; AGAINST: number;
      voters: Record<string, Array<{ id: string; name: string; avatarUrl: string | null }>>;
    }> = {};

    for (const r of rows) {
      if (!map[r.placeId]) {
        map[r.placeId] = {
          activityId: r.placeId, // Use placeId but call it activityId for frontend
          MUST: 0, OK: 0, IF_OTHERS: 0, NOT_REALLY: 0, AGAINST: 0,
          voters: { MUST: [], OK: [], IF_OTHERS: [], NOT_REALLY: [], AGAINST: [] },
        };
      }
      if (VALID_VOTES.has(r.vote)) {
        (map[r.placeId] as any)[r.vote]++;
        const user = userMap.get(r.userId);
        map[r.placeId].voters[r.vote]?.push({
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

    // NEW SCHEMA: Use PlaceVote
    await Promise.all(
      votes.filter(v => VALID_VOTES.has(v.vote)).map(({ activityId, vote }) =>
        prisma.placeVote.upsert({
          where: { placeId_userId: { placeId: activityId, userId: req.userId! } }, // activityId is actually placeId
          update: { vote },
          create: { placeId: activityId, tripId, userId: req.userId!, vote },
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

    // NEW SCHEMA: Use Place and PlaceVote
    const [activities, voteRows, existingEvents, flightRows] = await Promise.all([
      prisma.place.findMany({ where: { tripId }, orderBy: { createdAt: 'asc' } }),
      prisma.placeVote.findMany({ where: { tripId } }),
      prisma.scheduledEvent.findMany({
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
      if (!voteAgg.has(v.placeId)) { // Use placeId instead of activityId
        voteAgg.set(v.placeId, { must: 0, ok: 0, against: 0, score: 0, total: 0 });
      }
      const a = voteAgg.get(v.placeId)!;
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
      await prisma.scheduledEvent.deleteMany({
        where: { tripId, allDay: false },
      });
    }

    const activityIds = [...new Set(slots.map((s) => s.activityId).filter(Boolean))];
    const acts = await prisma.place.findMany({
      where: { tripId, id: { in: activityIds } },
    });
    const actMap = new Map(acts.map((a) => [a.id, a]));

    const created = [];
    const scheduledPlaceIds = new Set<string>(); // one place = one day: first slot wins
    for (const s of slots) {
      const act = actMap.get(s.activityId);
      if (!act) continue;
      if (scheduledPlaceIds.has(act.id)) continue;
      scheduledPlaceIds.add(act.id);
      const allDay = Boolean(s.allDay);
      const date = String(s.date).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

      const event = await prisma.scheduledEvent.create({
        data: {
          tripId,
          placeId: act.id,
          title: act.name,
          date,
          startMinute: allDay ? 0 : Math.max(0, Math.min(1439, Number(s.startMinute) || 0)),
          durationMins: allDay
            ? 1440
            : Math.max(15, Number(s.durationMins) || act.durationMins || 60),
          color: act.color || s.color || 'blue',
          notes: s.notes || null,
          allDay,
        },
        include: { files: true, place: true },
      });
      try { await removeOtherDayEventsForPlace(tripId, act.id, event.date, event.id); } catch { /* ignore */ }
      created.push(serializeScheduledEvent(event));
    }

    // Return full planner state
    const [allActs, allEvents] = await Promise.all([
      prisma.place.findMany({
        where: { tripId },
        orderBy: { createdAt: 'asc' },
        include: { files: true, votes: true },
      }),
      prisma.scheduledEvent.findMany({
        where: { tripId },
        orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
        include: { files: true, place: true },
      }),
    ]);

    res.json({
      ok: true,
      created: created.length,
      activities: allActs.map(serializePlaceAsActivity),
      events: allEvents.map(serializeScheduledEvent),
    });
  } catch (err) {
    console.error('[planner] ai-schedule apply', err);
    res.status(500).json({ error: 'שגיאה באישור לוח AI' });
  }
};
