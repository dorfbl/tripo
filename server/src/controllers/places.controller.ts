import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

// ─── GET /api/places/:tripId ──────────────────────────────────────────────────
export const getPlaces = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    const places = await prisma.tripPlace.findMany({
      where: { tripId },
      include: { photos: { orderBy: { createdAt: 'asc' } } },
      orderBy: { order: 'asc' },
    });

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
    const { name, lat, lng, notes } = req.body;

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    if (!name?.trim()) { res.status(400).json({ error: 'שם המקום חסר' }); return; }
    if (lat == null || lng == null) { res.status(400).json({ error: 'קואורדינטות חסרות' }); return; }

    // מספר סידורי — בסוף הרשימה
    const count = await prisma.tripPlace.count({ where: { tripId } });

    const place = await prisma.tripPlace.create({
      data: { tripId, name: name.trim(), lat: Number(lat), lng: Number(lng), notes: notes?.trim() || null, order: count },
      include: { photos: true },
    });

    res.status(201).json({ place });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהוספת מקום' });
  }
};

// ─── PUT /api/places/:placeId ────────────────────────────────────────────────
export const updatePlace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { placeId } = req.params as { placeId: string };
    const { name, notes } = req.body;

    const place = await prisma.tripPlace.findUnique({ where: { id: placeId } });
    if (!place) { res.status(404).json({ error: 'מקום לא נמצא' }); return; }

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId: place.tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    const updated = await prisma.tripPlace.update({
      where: { id: placeId },
      data: { name: name?.trim() || place.name, notes: notes?.trim() ?? place.notes },
      include: { photos: true },
    });

    res.json({ place: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון מקום' });
  }
};

// ─── DELETE /api/places/:placeId ─────────────────────────────────────────────
export const deletePlace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { placeId } = req.params as { placeId: string };

    const place = await prisma.tripPlace.findUnique({
      where: { id: placeId },
      include: { photos: true },
    });
    if (!place) { res.status(404).json({ error: 'מקום לא נמצא' }); return; }

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId: place.tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    // מחק קבצי תמונות
    for (const photo of place.photos) {
      const filePath = path.join('/home/dor/tripo/uploads', photo.url.replace('/uploads/', ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.tripPlace.delete({ where: { id: placeId } });
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

    const place = await prisma.tripPlace.findUnique({ where: { id: placeId } });
    if (!place) { res.status(404).json({ error: 'מקום לא נמצא' }); return; }

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId: place.tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    // כיווץ: 1200px רוחב מקסימלי, JPEG 85
    const originalPath = req.file.path;
    const filename     = `${path.basename(req.file.filename, path.extname(req.file.filename))}.jpg`;
    const outputPath   = path.join('/home/dor/tripo/uploads/places', filename);

    await sharp(originalPath)
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(outputPath);

    if (originalPath !== outputPath) fs.unlinkSync(originalPath);

    const caption = (req.body.caption as string | undefined)?.trim() || null;
    const photo = await prisma.placePhoto.create({
      data: { placeId, url: `/uploads/places/${filename}`, caption },
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

    await prisma.$transaction(
      ids.map((id, idx) => prisma.tripPlace.update({ where: { id }, data: { order: idx } }))
    );

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
