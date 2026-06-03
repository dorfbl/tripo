import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const VALID_TYPES = ['FLIGHT','HOTEL','CAR','ACTIVITY','RESTAURANT','BAR','MAP','INSURANCE','DOCUMENT','PAYMENT','OTHER'];
const VALID_STATUSES = ['SAVED','PENDING','BOOKED','PAID','MISSING','CANCELLED'];

async function getMember(tripId: string, userId: string) {
  return prisma.tripMember.findFirst({ where: { tripId, userId } });
}

// GET /api/links/:tripId
export const getLinks = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const userId = req.userId!;

    const member = await getMember(tripId, userId);
    if (!member) return res.status(403).json({ error: 'אין גישה לטיול זה' });

    const links = await prisma.tripLink.findMany({
      where: {
        tripId,
        OR: [{ isPrivate: false }, { createdByUserId: userId }],
      },
      include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });

    res.json(links);
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת הקישורים' });
  }
};

// POST /api/links/:tripId
export const createLink = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const userId = req.userId!;
    const { title, description, url, type, status, providerName, startDate, endDate, estimatedCost, currency, notes, decisionId, isPrivate, fileUrl, fileName } = req.body;

    const member = await getMember(tripId, userId);
    if (!member) return res.status(403).json({ error: 'אין גישה לטיול זה' });

    if (!title?.trim()) return res.status(400).json({ error: 'כותרת שדה חובה' });

    const finalType = VALID_TYPES.includes(type) ? type : 'OTHER';
    const rawUrl = url?.trim() || null;
    const finalUrl = rawUrl && !/^https?:\/\//i.test(rawUrl) ? `https://${rawUrl}` : rawUrl;
    const hasContent = finalUrl || fileUrl;
    const finalStatus = VALID_STATUSES.includes(status) ? status : (hasContent ? 'SAVED' : 'MISSING');

    const link = await prisma.tripLink.create({
      data: {
        tripId,
        title: title.trim(),
        description: description?.trim() || null,
        url: finalUrl,
        type: finalType as any,
        status: finalStatus as any,
        providerName: providerName?.trim() || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
        currency: currency || null,
        notes: notes?.trim() || null,
        decisionId: decisionId || null,
        isPrivate: Boolean(isPrivate),
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        createdByUserId: userId,
      },
      include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
    });

    res.status(201).json(link);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה ביצירת הקישור' });
  }
};

// PUT /api/links/:linkId
export const updateLink = async (req: AuthRequest, res: Response) => {
  try {
    const { linkId } = req.params;
    const userId = req.userId!;
    const { title, description, url, type, status, providerName, startDate, endDate, estimatedCost, currency, notes, isPrivate, fileUrl, fileName } = req.body;

    const link = await prisma.tripLink.findUnique({
      where: { id: linkId },
      include: { trip: { include: { members: true } } },
    });
    if (!link) return res.status(404).json({ error: 'קישור לא נמצא' });

    const member = link.trip.members.find(m => m.userId === userId);
    if (!member) return res.status(403).json({ error: 'אין גישה' });
    if (link.createdByUserId !== userId && member.role !== 'ADMIN') {
      return res.status(403).json({ error: 'רק יוצר הקישור או מנהל יכולים לערוך' });
    }

    // If replacing file, delete old one
    if (fileUrl !== undefined && fileUrl !== link.fileUrl && link.fileUrl) {
      const oldPath = path.join('/home/dor/tripo/uploads', link.fileUrl.replace('/uploads/', ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const updated = await prisma.tripLink.update({
      where: { id: linkId },
      data: {
        title: title?.trim() || link.title,
        description: description?.trim() ?? link.description,
        url: url !== undefined ? (url?.trim() ? (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`) : null) : link.url,
        type: (VALID_TYPES.includes(type) ? type : link.type) as any,
        status: (VALID_STATUSES.includes(status) ? status : link.status) as any,
        providerName: providerName?.trim() ?? link.providerName,
        startDate: startDate ? new Date(startDate) : link.startDate,
        endDate: endDate ? new Date(endDate) : link.endDate,
        estimatedCost: estimatedCost != null ? parseFloat(estimatedCost) : link.estimatedCost,
        currency: currency ?? link.currency,
        notes: notes?.trim() ?? link.notes,
        isPrivate: isPrivate !== undefined ? Boolean(isPrivate) : link.isPrivate,
        fileUrl: fileUrl !== undefined ? (fileUrl || null) : link.fileUrl,
        fileName: fileName !== undefined ? (fileName || null) : link.fileName,
      },
      include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'שגיאה בעדכון הקישור' });
  }
};

// DELETE /api/links/:linkId
export const deleteLink = async (req: AuthRequest, res: Response) => {
  try {
    const { linkId } = req.params;
    const userId = req.userId!;

    const link = await prisma.tripLink.findUnique({
      where: { id: linkId },
      include: { trip: { include: { members: true } } },
    });
    if (!link) return res.status(404).json({ error: 'קישור לא נמצא' });

    const member = link.trip.members.find(m => m.userId === userId);
    if (!member) return res.status(403).json({ error: 'אין גישה' });
    if (link.createdByUserId !== userId && member.role !== 'ADMIN') {
      return res.status(403).json({ error: 'רק יוצר הקישור או מנהל יכולים למחוק' });
    }

    // Delete associated file
    if (link.fileUrl) {
      const filePath = path.join('/home/dor/tripo/uploads', link.fileUrl.replace('/uploads/', ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.tripLink.delete({ where: { id: linkId } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'שגיאה במחיקת הקישור' });
  }
};

// PATCH /api/links/:linkId/pin
export const togglePin = async (req: AuthRequest, res: Response) => {
  try {
    const { linkId } = req.params;
    const userId = req.userId!;

    const link = await prisma.tripLink.findUnique({
      where: { id: linkId },
      include: { trip: { include: { members: true } } },
    });
    if (!link) return res.status(404).json({ error: 'קישור לא נמצא' });

    const member = link.trip.members.find(m => m.userId === userId);
    if (!member || member.role !== 'ADMIN') {
      return res.status(403).json({ error: 'רק מנהל יכול לנעוץ קישורים' });
    }

    const updated = await prisma.tripLink.update({
      where: { id: linkId },
      data: { isPinned: !link.isPinned },
      include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'שגיאה בנעיצת הקישור' });
  }
};

// PATCH /api/links/:linkId/status
export const updateStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { linkId } = req.params;
    const userId = req.userId!;
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'סטטוס לא תקין' });

    const link = await prisma.tripLink.findUnique({
      where: { id: linkId },
      include: { trip: { include: { members: true } } },
    });
    if (!link) return res.status(404).json({ error: 'קישור לא נמצא' });

    const member = link.trip.members.find(m => m.userId === userId);
    if (!member) return res.status(403).json({ error: 'אין גישה' });

    const updated = await prisma.tripLink.update({
      where: { id: linkId },
      data: { status: status as any },
      include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'שגיאה בעדכון הסטטוס' });
  }
};

// POST /api/links/:tripId/upload
export const uploadFile = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const userId = req.userId!;

    const member = await getMember(tripId, userId);
    if (!member) return res.status(403).json({ error: 'אין גישה לטיול זה' });

    if (!req.file) return res.status(400).json({ error: 'לא נשלח קובץ' });

    const fileUrl = `/uploads/links/${req.file.filename}`;
    const fileName = req.file.originalname;

    res.json({ fileUrl, fileName });
  } catch {
    res.status(500).json({ error: 'שגיאה בהעלאת הקובץ' });
  }
};
