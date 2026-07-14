import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { timelinePlaceAdded, timelinePhotoUploaded } from '../services/timeline.service';
import { clearHoursNotificationsForEvent } from '../services/notifications.service';

// ─── Map ⇄ Scheduler sync ────────────────────────────────────────────────────
// The scheduler (ScheduledEvent) is the single source of truth for which day a
// place belongs to and its order within the day. The map derives day + order
// from it, and map-side day assignments create/move/delete scheduled events.
const DAY_START_MINUTE = 8 * 60; // first place of a day defaults to 08:00

/** placeId → { date, order } derived from scheduled events (earliest event wins). */
const getScheduleByPlace = async (tripId: string) => {
  const events = await prisma.scheduledEvent.findMany({
    where: { tripId, placeId: { not: null } },
    orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
    select: { placeId: true, date: true, startMinute: true },
  });
  const byPlace = new Map<string, { date: string; order: number }>();
  const dayCounters = new Map<string, number>();
  for (const ev of events) {
    if (!ev.placeId || byPlace.has(ev.placeId)) continue;
    const idx = dayCounters.get(ev.date) ?? 0;
    byPlace.set(ev.placeId, { date: ev.date, order: idx });
    dayCounters.set(ev.date, idx + 1);
  }
  return byPlace;
};

/** Start minute for a new event on `date`: 08:00 if the day is empty, otherwise right after the last event. */
const nextStartMinute = async (tripId: string, date: string, excludePlaceId?: string) => {
  const last = await prisma.scheduledEvent.findFirst({
    where: { tripId, date, allDay: false, ...(excludePlaceId ? { NOT: { placeId: excludePlaceId } } : {}) },
    orderBy: [{ startMinute: 'desc' }],
  });
  if (!last) return DAY_START_MINUTE;
  return Math.min(last.startMinute + last.durationMins, 23 * 60 + 45);
};

/** Sync a map-side day assignment into the scheduler (create / move / delete the place's event). */
const syncPlaceEventDate = async (
  tripId: string,
  place: { id: string; name: string; durationMins: number | null; color: string | null },
  newDate: string | null,
) => {
  const events = await prisma.scheduledEvent.findMany({
    where: { tripId, placeId: place.id },
    orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
  });

  if (!newDate) {
    // Day removed on the map → remove from the scheduler
    for (const ev of events) {
      await prisma.scheduledEvent.delete({ where: { id: ev.id } });
      try { await clearHoursNotificationsForEvent(tripId, ev.id); } catch { /* ignore */ }
    }
    return;
  }

  if (events.some((ev) => ev.date === newDate)) {
    // Already scheduled on that day — just drop stale events on other days
    const stale = events.filter((ev) => ev.date !== newDate);
    for (const ev of stale) {
      await prisma.scheduledEvent.delete({ where: { id: ev.id } });
      try { await clearHoursNotificationsForEvent(tripId, ev.id); } catch { /* ignore */ }
    }
    return;
  }

  const durationMins = Math.max(15, place.durationMins || 60);
  const startMinute = await nextStartMinute(tripId, newDate, place.id);

  if (events.length) {
    // Move the existing event to the new day, directly after its last event
    await prisma.scheduledEvent.update({
      where: { id: events[0].id },
      data: { date: newDate, startMinute },
    });
    for (const ev of events.slice(1)) {
      await prisma.scheduledEvent.delete({ where: { id: ev.id } });
      try { await clearHoursNotificationsForEvent(tripId, ev.id); } catch { /* ignore */ }
    }
  } else {
    await prisma.scheduledEvent.create({
      data: {
        tripId,
        placeId: place.id,
        title: place.name,
        date: newDate,
        startMinute,
        durationMins,
        color: place.color || 'blue',
      },
    });
  }
};

// ─── GET /api/places/:tripId ──────────────────────────────────────────────────
export const getPlaces = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    // NEW SCHEMA: Get places with their map points. Some migrated/imported
    // places may not have MapPoint rows yet, so include them as undated pins.
    const mapPoints = await prisma.mapPoint.findMany({
      where: { tripId },
      include: {
        place: {
          include: { photos: { orderBy: { createdAt: 'asc' } } }
        }
      },
      orderBy: [{ date: 'asc' }, { order: 'asc' }],
    });

    // Scheduler is the source of truth for day + order of scheduled places
    const scheduleByPlace = await getScheduleByPlace(tripId);

    const mappedPlaceIds = [...new Set(mapPoints.map((mp) => mp.placeId))];
    const placesWithoutMapPoints = await prisma.place.findMany({
      where: {
        tripId,
        ...(mappedPlaceIds.length ? { id: { notIn: mappedPlaceIds } } : {}),
      },
      include: { photos: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });

    const serializePlace = (
      place: (typeof mapPoints)[number]['place'] | (typeof placesWithoutMapPoints)[number],
      mapPoint: (typeof mapPoints)[number] | null,
      fallbackOrder: number,
      scheduled: { date: string; order: number } | null = null,
    ) => ({
      id: place.id,
      tripId: place.tripId,
      name: place.name,
      nameOriginal: place.nameOriginal,
      lat: place.lat,
      lng: place.lng,
      notes: mapPoint?.notes || place.notes || place.description,
      description: place.description,
      location: place.location,
      mapsUrl: place.mapsUrl,
      url: place.url,
      date: scheduled?.date ?? null,
      order: scheduled?.order ?? mapPoint?.order ?? fallbackOrder,
      category: place.category,
      placeId: place.placeId,
      openingHours: place.openingHours,
      rating: place.rating,
      ratingCount: place.ratingCount,
      cost: place.cost,
      durationMins: place.durationMins,
      estimatedDuration: place.estimatedDuration,
      photos: place.photos.map((photo) => ({
        id: photo.id,
        placeId: photo.placeId,
        url: photo.url,
        caption: photo.caption,
        createdAt: photo.createdAt,
      })),
      item: {
        id: place.id,
        name: place.name,
        nameOriginal: place.nameOriginal,
        lat: place.lat,
        lng: place.lng,
        description: place.description,
        location: place.location,
        mapsUrl: place.mapsUrl,
        url: place.url,
        category: place.category,
        placeId: place.placeId,
        openingHours: place.openingHours,
        rating: place.rating,
        ratingCount: place.ratingCount,
        cost: place.cost,
        durationMins: place.durationMins,
        estimatedDuration: place.estimatedDuration,
      },
    });

    // Serialize with ALL Place fields from CSV
    const places = [
      ...mapPoints.map((mp) =>
        serializePlace(mp.place, mp, mp.order, scheduleByPlace.get(mp.placeId) ?? null),
      ),
      ...placesWithoutMapPoints.map((place, index) =>
        serializePlace(place, null, mapPoints.length + index, scheduleByPlace.get(place.id) ?? null),
      ),
    ];

    res.json({ places });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת המקומות' });
  }
};

// ─── POST /api/places/:tripId ─────────────────────────────────────────────────
export const addPlace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    const { name, lat, lng, notes, mapsUrl, url, date, category } = req.body;

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    if (!name?.trim()) { res.status(400).json({ error: 'שם המקום חסר' }); return; }
    if (lat == null || lng == null) { res.status(400).json({ error: 'קואורדינטות חסרות' }); return; }

    // NEW SCHEMA: Create Place
    const place = await prisma.place.create({
      data: {
        tripId,
        name: name.trim(),
        lat: Number(lat),
        lng: Number(lng),
        description: notes?.trim() || null,
        mapsUrl: mapsUrl?.trim() || null,
        url: url?.trim() || null,
        category: category?.trim() || 'other',
        emoji: '📍',
        color: 'blue',
      },
      include: { photos: true },
    });

    // Create MapPoint for map display
    const count = await prisma.mapPoint.count({ where: { tripId, date: date || null } });
    const mapPoint = await prisma.mapPoint.create({
      data: {
        tripId,
        placeId: place.id,
        date: date?.trim() || null,
        order: count,
        notes: notes?.trim() || null,
      },
    });

    // Sync into the scheduler: assigning a day on the map schedules the place
    // right after the day's last event (08:00 if it's the first)
    if (date?.trim()) {
      await syncPlaceEventDate(tripId, place, date.trim());
    }

    await timelinePlaceAdded({
      tripId,
      userId: req.userId!,
      placeId: place.id,
      placeName: place.name,
    });

    // Return in old format
    const serialized = {
      id: place.id,
      tripId: place.tripId,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      notes: mapPoint.notes || place.description,
      mapsUrl: place.mapsUrl,
      date: mapPoint.date,
      order: mapPoint.order,
      category: place.category,
      placeId: place.placeId,
      openingHours: place.openingHours,
      photos: [],
      item: {
        id: place.id,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        description: place.description,
        mapsUrl: place.mapsUrl,
        url: place.url,
        category: place.category,
      },
    };

    res.status(201).json({ place: serialized });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהוספת מקום' });
  }
};

// ─── PUT /api/places/:placeId ────────────────────────────────────────────────
export const updatePlace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { placeId } = req.params as { placeId: string };
    const { name, notes, date, category, mapsUrl, url, lat, lng } = req.body;

    // NEW SCHEMA: Find place
    const place = await prisma.place.findUnique({ where: { id: placeId } });
    if (!place) { res.status(404).json({ error: 'מקום לא נמצא' }); return; }

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId: place.tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    // Update Place
    const updated = await prisma.place.update({
      where: { id: placeId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(notes !== undefined && { description: notes?.trim() || null }),
        ...(category !== undefined && { category: category?.trim() || 'other' }),
        ...(mapsUrl !== undefined && { mapsUrl: mapsUrl?.trim() || null }),
        ...(url !== undefined && { url: url?.trim() || null }),
        ...(lat !== undefined && { lat: Number(lat) }),
        ...(lng !== undefined && { lng: Number(lng) }),
      },
      include: { photos: true },
    });

    // Notes live on the MapPoint — create it if the place has none yet
    if (notes !== undefined) {
      const mapPoint = await prisma.mapPoint.findFirst({
        where: { tripId: place.tripId, placeId }
      });

      if (mapPoint) {
        await prisma.mapPoint.update({
          where: { id: mapPoint.id },
          data: { notes: notes?.trim() || null },
        });
      } else {
        const order = await prisma.mapPoint.count({ where: { tripId: place.tripId } });
        await prisma.mapPoint.create({
          data: {
            tripId: place.tripId,
            placeId,
            date: null,
            order,
            notes: notes?.trim() || null,
          },
        });
      }
    }

    // Day assignment syncs to the scheduler (ScheduledEvent is the source of truth):
    // new day → event created right after the day's last event (08:00 if first);
    // day cleared → the place's event is removed from the scheduler.
    if (date !== undefined) {
      await syncPlaceEventDate(place.tripId, updated, date?.trim() || null);
    }

    // Get map point + scheduled event for response
    const mapPoint = await prisma.mapPoint.findFirst({
      where: { tripId: place.tripId, placeId }
    });
    const scheduledEvent = await prisma.scheduledEvent.findFirst({
      where: { tripId: place.tripId, placeId },
      orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
    });

    const serialized = {
      id: updated.id,
      tripId: updated.tripId,
      name: updated.name,
      lat: updated.lat,
      lng: updated.lng,
      notes: mapPoint?.notes || updated.description,
      mapsUrl: updated.mapsUrl,
      date: scheduledEvent?.date ?? null,
      order: mapPoint?.order || 0,
      category: updated.category,
      placeId: updated.placeId,
      openingHours: updated.openingHours,
      photos: updated.photos.map((photo) => ({
        id: photo.id,
        placeId: photo.placeId,
        url: photo.url,
        caption: photo.caption,
        createdAt: photo.createdAt,
      })),
      item: {
        id: updated.id,
        name: updated.name,
        lat: updated.lat,
        lng: updated.lng,
        description: updated.description,
        mapsUrl: updated.mapsUrl,
        url: updated.url,
        category: updated.category,
      },
    };

    res.json({ place: serialized });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון מקום' });
  }
};

// ─── DELETE /api/places/:placeId ─────────────────────────────────────────────
export const deletePlace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { placeId } = req.params as { placeId: string };

    // NEW SCHEMA: Find place with photos
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      include: { photos: true },
    });
    if (!place) { res.status(404).json({ error: 'מקום לא נמצא' }); return; }

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId: place.tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    // Delete photo files
    for (const photo of place.photos) {
      const filePath = path.join('/home/dor/tripo/uploads', photo.url.replace('/uploads/', ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    // Delete place (CASCADE will handle MapPoints, photos, etc.)
    await prisma.place.delete({ where: { id: placeId } });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה במחיקת מקום' });
  }
};

// ─── POST /api/places/:placeId/photos ────────────────────────────────────────
export const addPhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { placeId } = req.params as { placeId: string };

    if (!req.file) { res.status(400).json({ error: 'לא נשלחה תמונה' }); return; }

    // NEW SCHEMA: Find place
    const place = await prisma.place.findUnique({ where: { id: placeId } });
    if (!place) { res.status(404).json({ error: 'מקום לא נמצא' }); return; }

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId: place.tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    const { assertCanUpload, recordStorageDelta, LimitError, limitErrorPayload } =
      await import('../services/limits.service');
    try {
      await assertCanUpload(req.userId!, req.file.size || 500_000);
    } catch (err) {
      if (err instanceof LimitError) {
        try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
        res.status(err.status).json(limitErrorPayload(err));
        return;
      }
      throw err;
    }

    // Compress: 1200px max width, JPEG 85
    const originalPath = req.file.path;
    const filename     = `${path.basename(req.file.filename, path.extname(req.file.filename))}.jpg`;
    const outputPath   = path.join('/home/dor/tripo/uploads/places', filename);

    await sharp(originalPath)
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(outputPath);

    if (originalPath !== outputPath) fs.unlinkSync(originalPath);
    const finalSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : req.file.size;
    await recordStorageDelta(req.userId!, finalSize);

    const caption = (req.body.caption as string | undefined)?.trim() || null;
    const photo = await prisma.placePhoto.create({
      data: { placeId, url: `/uploads/places/${filename}`, caption },
    });

    await timelinePhotoUploaded({
      tripId: place.tripId,
      userId: req.userId!,
      placeId: place.id,
      placeName: place.name,
      photoId: photo.id,
    });

    res.status(201).json({ photo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהעלאת תמונה' });
  }
};

// ─── PUT /api/places/:tripId/reorder ────────────────────────────────────────
export const reorderPlaces = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    const { ids } = req.body as { ids: string[] }; // ordered array of place ids

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    // NEW SCHEMA: Update MapPoint order — create missing MapPoints so the
    // order persists for places that don't have a map point yet.
    const updates = [];
    for (let idx = 0; idx < ids.length; idx++) {
      const placeId = ids[idx];
      const mapPoint = await prisma.mapPoint.findFirst({
        where: { tripId, placeId }
      });

      if (mapPoint) {
        updates.push(
          prisma.mapPoint.update({
            where: { id: mapPoint.id },
            data: { order: idx }
          })
        );
      } else {
        updates.push(
          prisma.mapPoint.create({
            data: { tripId, placeId, date: null, order: idx }
          })
        );
      }
    }

    await prisma.$transaction(updates);

    // Sync the new order into the scheduler: re-time each affected day's
    // events sequentially (first at its day's start, each next one right
    // after the previous place).
    const events = await prisma.scheduledEvent.findMany({
      where: { tripId, placeId: { in: ids } },
      orderBy: [{ startMinute: 'asc' }],
    });
    const byDate = new Map<string, typeof events>();
    for (const ev of events) {
      if (ev.allDay) continue;
      const list = byDate.get(ev.date) ?? [];
      list.push(ev);
      byDate.set(ev.date, list);
    }
    const retimes = [];
    for (const [, dayEvents] of byDate) {
      // Keep the day's existing start time (08:00 default is applied on creation)
      const dayStart = Math.min(...dayEvents.map((ev) => ev.startMinute));
      const sorted = [...dayEvents].sort(
        (a, b) => ids.indexOf(a.placeId!) - ids.indexOf(b.placeId!),
      );
      let cursor = dayStart;
      for (const ev of sorted) {
        const startMinute = Math.min(cursor, 23 * 60 + 45);
        if (startMinute !== ev.startMinute) {
          retimes.push(prisma.scheduledEvent.update({ where: { id: ev.id }, data: { startMinute } }));
        }
        cursor = startMinute + ev.durationMins;
      }
    }
    if (retimes.length) await prisma.$transaction(retimes);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בסידור מחדש' });
  }
};

// ─── DELETE /api/places/photos/:photoId ──────────────────────────────────────
export const deletePhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { photoId } = req.params as { photoId: string };

    const photo = await prisma.placePhoto.findUnique({
      where: { id: photoId },
      include: { place: true },
    });
    if (!photo) { res.status(404).json({ error: 'תמונה לא נמצאה' }); return; }

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId: photo.place.tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    const filePath = path.join('/home/dor/tripo/uploads', photo.url.replace('/uploads/', ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.placePhoto.delete({ where: { id: photoId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה במחיקת תמונה' });
  }
};
