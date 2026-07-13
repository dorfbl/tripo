import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import type { TimelineCategory } from '../services/timeline.service';
import { recordTimelineEvent } from '../services/timeline.service';
import { generateTimelineDayStories, isAiAllowedForTrip, isAiConfigured } from '../services/ai.service';
import {
  assertCanUseAi,
  LimitError,
  limitErrorPayload,
  recordAiCall,
} from '../services/limits.service';

const FILTER_CATEGORIES = new Set<TimelineCategory | 'all'>([
  'all',
  'expenses',
  'places',
  'photos',
  'decisions',
  'documents',
  'members',
  'memory',
  'ai',
]);

async function assertMember(tripId: string, userId: string) {
  return prisma.tripMember.findUnique({
    where: { userId_tripId: { userId, tripId } },
  });
}

const serialize = (e: any) => ({
  id: e.id,
  tripId: e.tripId,
  type: e.type,
  category: e.category,
  title: e.title,
  description: e.description,
  emoji: e.emoji,
  isPrivate: e.isPrivate,
  aiGenerated: Boolean(e.aiGenerated),
  createdByUserId: e.createdByUserId,
  createdBy: e.createdBy
    ? { id: e.createdBy.id, name: e.createdBy.name, avatarUrl: e.createdBy.avatarUrl }
    : null,
  refType: e.refType,
  refId: e.refId,
  metadata: e.metadata,
  occurredAt: e.occurredAt,
  createdAt: e.createdAt,
});

// GET /api/timeline/:tripId?filter=&limit=&before=
export const getTimeline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    const userId = req.userId!;
    const filter = String(req.query.filter || 'all') as TimelineCategory | 'all';
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 100);
    const before = req.query.before ? new Date(String(req.query.before)) : null;

    if (!FILTER_CATEGORIES.has(filter)) {
      res.status(400).json({ error: 'פילטר לא תקין' });
      return;
    }

    const member = await assertMember(tripId, userId);
    if (!member) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    const events = await prisma.timelineEvent.findMany({
      where: {
        tripId,
        ...(filter !== 'all' ? { category: filter } : {}),
        OR: [{ isPrivate: false }, { createdByUserId: userId }],
        ...(before && !Number.isNaN(before.getTime())
          ? { occurredAt: { lt: before } }
          : {}),
      },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { aiEnabled: true },
    });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiEnabled: true },
    });

    res.json({
      events: events.map(serialize),
      ai: {
        configured: isAiConfigured(),
        tripEnabled: trip?.aiEnabled !== false,
        userEnabled: user?.aiEnabled !== false,
        allowed: Boolean(
          isAiConfigured() && trip?.aiEnabled !== false && user?.aiEnabled !== false,
        ),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת ציר הזמן' });
  }
};

// POST /api/timeline/:tripId/ai-recap — full day-by-day AI story cards
export const createAiRecap = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    const userId = req.userId!;
    const replaceExisting = req.body?.replace !== false; // default: refresh old AI day cards

    const member = await assertMember(tripId, userId);
    if (!member) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

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
    if (!trip) {
      res.status(404).json({ error: 'טיול לא נמצא' });
      return;
    }

    const events = await prisma.timelineEvent.findMany({
      where: {
        tripId,
        type: { notIn: ['AI_RECAP', 'AI_NOTE'] },
        OR: [{ isPrivate: false }, { createdByUserId: userId }],
      },
      orderBy: { occurredAt: 'asc' },
      take: 200,
    });

    if (events.length < 1) {
      res.status(400).json({ error: 'אין עדיין אירועים בציר הזמן לסיכום' });
      return;
    }

    // Optional planner context per day
    const plannerEvents = await prisma.plannerEvent.findMany({
      where: { tripId },
      orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
      take: 100,
    });
    const plannerByDay: Record<string, string[]> = {};
    for (const pe of plannerEvents) {
      if (!plannerByDay[pe.date]) plannerByDay[pe.date] = [];
      const h = Math.floor(pe.startMinute / 60);
      const m = pe.startMinute % 60;
      const time = pe.allDay
        ? 'כל היום'
        : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      plannerByDay[pe.date].push(`${time} ${pe.title}`);
    }

    // Consume AI quota before calling the model
    await recordAiCall(userId, 1);

    const dayStories = await generateTimelineDayStories({
      tripName: trip.name,
      events: events.map((e) => ({
        emoji: e.emoji,
        title: e.title,
        description: e.description,
        occurredAt: e.occurredAt,
        category: e.category,
      })),
      plannerByDay,
    });

    if (!dayStories?.length) {
      res.status(502).json({
        error:
          'לא הצלחנו לייצר סיכום AI לפי ימים (בדוק מפתח AI / מודל, או נסה שוב)',
      });
      return;
    }

    if (replaceExisting) {
      // Remove previous AI day cards for this trip so re-run refreshes cleanly
      await prisma.timelineEvent.deleteMany({
        where: { tripId, type: 'AI_RECAP', category: 'ai' },
      });
    }

    for (const day of dayStories) {
      // Place card at evening of that day so it groups under the right day header
      const occurredAt = new Date(`${day.date}T20:00:00.000Z`);
      const heDate = new Date(`${day.date}T12:00:00`).toLocaleDateString('he-IL', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });

      await recordTimelineEvent({
        tripId,
        type: 'AI_RECAP',
        category: 'ai',
        title: `${day.emoji} ${day.title}`,
        description: day.description,
        emoji: day.emoji || '✨',
        aiGenerated: true,
        createdByUserId: userId,
        occurredAt,
        notify: false, // one notify at end, not per day
        metadata: { date: day.date, kind: 'day_story', heDate },
        notifyHref: `/trip/${tripId}/timeline`,
      });
    }

    // Single notify for the batch
    const { notifyTripMembers } = await import('../services/notifications.service');
    await notifyTripMembers(
      tripId,
      {
        type: 'ai',
        title: `✨ סיכום AI ל־${dayStories.length} ימים`,
        body: 'נוסף סיפור יומי מלא לציר הזמן',
        emoji: '✨',
        href: `/trip/${tripId}/timeline`,
        aiGenerated: true,
      },
      userId,
    );

    const createdEvents = await prisma.timelineEvent.findMany({
      where: { tripId, type: 'AI_RECAP', category: 'ai' },
      orderBy: { occurredAt: 'asc' },
      include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
    });

    res.status(201).json({
      days: dayStories.length,
      events: createdEvents.map(serialize),
      // keep backward-compatible single field (last day)
      event: createdEvents.length
        ? serialize(createdEvents[createdEvents.length - 1])
        : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה ביצירת סיכום AI' });
  }
};

// POST /api/timeline/:tripId  — manual memory
export const createMemory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    const userId = req.userId!;
    const { title, description, emoji, occurredAt } = req.body;

    const member = await assertMember(tripId, userId);
    if (!member) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    if (!title?.trim()) {
      res.status(400).json({ error: 'כותרת שדה חובה' });
      return;
    }

    const when = occurredAt ? new Date(occurredAt) : new Date();
    if (Number.isNaN(when.getTime())) {
      res.status(400).json({ error: 'תאריך לא תקין' });
      return;
    }

    await recordTimelineEvent({
      tripId,
      type: 'MEMORY',
      category: 'memory',
      title: title.trim(),
      description: description?.trim() || null,
      emoji: (emoji?.trim() || '✨').slice(0, 8),
      createdByUserId: userId,
      occurredAt: when,
      notify: true,
      notifyHref: `/trip/${tripId}/timeline`,
    });

    const event = await prisma.timelineEvent.findFirst({
      where: { tripId, type: 'MEMORY', createdByUserId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    res.status(201).json({ event: event ? serialize(event) : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהוספת זיכרון' });
  }
};

// DELETE /api/timeline/:eventId
export const deleteTimelineEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params as { eventId: string };
    const userId = req.userId!;

    const event = await prisma.timelineEvent.findUnique({
      where: { id: eventId },
      include: { trip: { include: { members: true } } },
    });
    if (!event) {
      res.status(404).json({ error: 'אירוע לא נמצא' });
      return;
    }

    const member = event.trip.members.find((m) => m.userId === userId);
    if (!member) {
      res.status(403).json({ error: 'אין גישה' });
      return;
    }

    const isAdmin = member.role === 'ADMIN';
    const isOwner = event.createdByUserId === userId;
    // Manual memories: creator or admin. Auto events: admin only.
    if (event.type === 'MEMORY') {
      if (!isOwner && !isAdmin) {
        res.status(403).json({ error: 'רק היוצר או מנהל יכולים למחוק' });
        return;
      }
    } else if (!isAdmin) {
      res.status(403).json({ error: 'רק מנהל יכול למחוק אירוע אוטומטי' });
      return;
    }

    await prisma.timelineEvent.delete({ where: { id: eventId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה במחיקת אירוע' });
  }
};
