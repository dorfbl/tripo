import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const checkMember = (tripId: string, userId: string) =>
  prisma.tripMember.findUnique({ where: { userId_tripId: { userId, tripId } } });

export const getPlanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }

    const [activities, events] = await Promise.all([
      prisma.plannerActivity.findMany({ where: { tripId }, orderBy: { createdAt: 'asc' }, include: { files: true } }),
      prisma.plannerEvent.findMany({ where: { tripId }, orderBy: [{ date: 'asc' }, { startMinute: 'asc' }], include: { files: true } }),
    ]);
    res.json({ activities, events });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const createActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const { name, emoji, location, description, durationMins, cost, category, mapsUrl, url, color } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'שם שדה חובה' }); return; }
    const activity = await prisma.plannerActivity.create({
      data: { tripId, name: name.trim(), emoji: emoji || '📌', location: location || null, description: description || null, durationMins: durationMins ?? 60, cost: cost || null, category: category || 'other', mapsUrl: mapsUrl || null, url: url || null, color: color || 'blue' },
      include: { files: true },
    });
    res.status(201).json({ activity });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const bulkCreateActivities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const { activities } = req.body as { activities: any[] };
    if (!Array.isArray(activities) || activities.length === 0) { res.status(400).json({ error: 'invalid' }); return; }
    await prisma.plannerActivity.createMany({
      data: activities.map(a => ({
        tripId, name: a.name, emoji: a.emoji || '📌', location: a.location || null,
        description: a.description || null, durationMins: a.durationMins ?? 60,
        cost: a.cost || null, category: a.category || 'other', mapsUrl: a.mapsUrl || null, url: a.url || null, color: a.color || 'blue',
      })),
    });
    const all = await prisma.plannerActivity.findMany({ where: { tripId }, orderBy: { createdAt: 'asc' }, include: { files: true } });
    res.status(201).json({ activities: all });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const updateActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, actId } = req.params;
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const { name, emoji, location, description, durationMins, cost, category, mapsUrl, url, color } = req.body;
    const activity = await prisma.plannerActivity.update({
      where: { id: actId },
      data: { ...(name && { name: name.trim() }), emoji, location, description, durationMins, cost, category, mapsUrl, url: url ?? undefined, color },
      include: { files: true },
    });
    res.json({ activity });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const deleteActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, actId } = req.params;
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    await prisma.plannerActivity.delete({ where: { id: actId } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const uploadActivityFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, actId } = req.params;
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    if (!req.file) { res.status(400).json({ error: 'קובץ חסר' }); return; }
    const file = await prisma.plannerActivityFile.create({
      data: { activityId: actId, filename: req.file.filename, originalName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size },
    });
    res.status(201).json({ file });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const deleteActivityFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, fileId } = req.params;
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
    const { tripId } = req.params;
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const { activityId, title, date, startMinute, durationMins, color, notes, allDay, url, mapsUrl, cost } = req.body;
    if (!title?.trim() || !date) { res.status(400).json({ error: 'שדות חסרים' }); return; }
    const event = await prisma.plannerEvent.create({
      data: { tripId, activityId: activityId || null, title: title.trim(), date, startMinute: allDay ? 0 : (startMinute ?? 0), durationMins: durationMins ?? 60, color: color || 'blue', notes: notes || null, allDay: Boolean(allDay), url: url || null, mapsUrl: mapsUrl || null, cost: cost || null },
      include: { files: true },
    });
    res.status(201).json({ event });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, eventId } = req.params;
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const { title, date, startMinute, durationMins, color, notes, allDay, url, mapsUrl, cost } = req.body;
    const event = await prisma.plannerEvent.update({
      where: { id: eventId },
      data: {
        ...(title && { title: title.trim() }),
        ...(date && { date }),
        ...(startMinute !== undefined && { startMinute }),
        ...(durationMins && { durationMins }),
        ...(color && { color }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(allDay !== undefined && { allDay: Boolean(allDay) }),
        ...(url !== undefined && { url: url || null }),
        ...(mapsUrl !== undefined && { mapsUrl: mapsUrl || null }),
        ...(cost !== undefined && { cost: cost || null }),
      },
      include: { files: true },
    });
    res.json({ event });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, eventId } = req.params;
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    await prisma.plannerEvent.delete({ where: { id: eventId } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const uploadEventFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, eventId } = req.params;
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    if (!req.file) { res.status(400).json({ error: 'קובץ חסר' }); return; }
    const file = await prisma.plannerEventFile.create({
      data: { eventId, filename: req.file.filename, originalName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size },
    });
    res.status(201).json({ file });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const deleteEventFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId, fileId } = req.params;
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
    const { tripId } = req.params;
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const rows = await prisma.plannerActivityVote.findMany({ where: { tripId, userId: req.userId! } });
    const votes: Record<string, string> = {};
    for (const r of rows) votes[r.activityId] = r.vote;
    res.json({ votes });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const getVotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
    if (!await checkMember(tripId, req.userId!)) { res.status(403).json({ error: 'אין גישה' }); return; }
    const rows = await prisma.plannerActivityVote.findMany({ where: { tripId } });
    const map: Record<string, { activityId: string; MUST: number; OK: number; IF_OTHERS: number; NOT_REALLY: number; AGAINST: number }> = {};
    for (const r of rows) {
      if (!map[r.activityId]) map[r.activityId] = { activityId: r.activityId, MUST: 0, OK: 0, IF_OTHERS: 0, NOT_REALLY: 0, AGAINST: 0 };
      if (VALID_VOTES.has(r.vote)) (map[r.activityId] as any)[r.vote]++;
    }
    res.json({ votes: Object.values(map) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
};

export const submitVotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
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
