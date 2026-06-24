import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const createTrip = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, startDate, endDate } = req.body;

    if (!name) {
      res.status(400).json({ error: 'שם הטיול הוא שדה חובה' });
      return;
    }

    const trip = await prisma.trip.create({
      data: {
        name,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        ownerId: req.userId!,
        members: {
          create: {
            userId: req.userId!,
            role: 'ADMIN',
          },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
      },
    });

    res.status(201).json({ trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה ביצירת הטיול' });
  }
};

export const getTrips = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const trips = await prisma.trip.findMany({
      where: {
        members: { some: { userId: req.userId } },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ trips });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת הטיולים' });
  }
};

export const getTrip = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
      },
    });

    if (!trip) {
      res.status(404).json({ error: 'טיול לא נמצא' });
      return;
    }

    const isMember = trip.members.some((m) => m.userId === req.userId);
    if (!isMember) {
      res.status(403).json({ error: 'אין לך גישה לטיול זה' });
      return;
    }

    res.json({ trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת פרטי הטיול' });
  }
};

export const joinTrip = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const inviteCode = req.params['inviteCode'] as string;

    const trip = await prisma.trip.findUnique({ where: { inviteCode } });
    if (!trip) {
      res.status(404).json({ error: 'קוד הזמנה לא תקין' });
      return;
    }

    const existing = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId: trip.id } },
    });

    if (existing) {
      res.status(400).json({ error: 'אתה כבר חבר בטיול זה' });
      return;
    }

    const member = await prisma.tripMember.create({
      data: { userId: req.userId!, tripId: trip.id, role: 'MEMBER' },
      include: { trip: true },
    });

    res.status(201).json({ message: 'הצטרפת לטיול בהצלחה!', trip: member.trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהצטרפות לטיול' });
  }
};

export const updateTrip = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { name, startDate, endDate, status } = req.body;

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId: id } },
    });
    if (!member)                { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }
    if (member.role !== 'ADMIN') { res.status(403).json({ error: 'רק מנהל הטיול יכול לערוך' }); return; }

    if (name !== undefined && !name?.trim()) {
      res.status(400).json({ error: 'שם הטיול לא יכול להיות ריק' }); return;
    }

    const VALID_STATUSES = ['PLAN', 'LIVE', 'FINISHED', 'CANCELED'];
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: 'סטטוס לא תקין' }); return;
    }

    const trip = await prisma.trip.update({
      where: { id },
      data: {
        ...(name      !== undefined && { name: name.trim() }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate   !== undefined && { endDate:   endDate   ? new Date(endDate)   : null }),
        ...(status    !== undefined && { status: status as any }),
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
      },
    });
    res.json({ trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון הטיול' });
  }
};

export const removeMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, userId: targetUserId } = req.params as { id: string; userId: string };

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) { res.status(404).json({ error: 'טיול לא נמצא' }); return; }

    const admin = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId: id } },
    });
    if (!admin)                { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }
    if (admin.role !== 'ADMIN') { res.status(403).json({ error: 'רק מנהל יכול להסיר חברים' }); return; }
    if (targetUserId === req.userId) { res.status(400).json({ error: 'לא ניתן להסיר את עצמך' }); return; }
    if (targetUserId === trip.ownerId) { res.status(400).json({ error: 'לא ניתן להסיר את מייסד הטיול' }); return; }

    const target = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: targetUserId, tripId: id } },
    });
    if (!target) { res.status(404).json({ error: 'חבר לא נמצא בטיול' }); return; }

    await prisma.tripMember.delete({
      where: { userId_tripId: { userId: targetUserId, tripId: id } },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהסרת חבר' });
  }
};

export const changeMemberRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, userId: targetUserId } = req.params as { id: string; userId: string };
    const { role } = req.body as { role: 'ADMIN' | 'MEMBER' };

    if (role !== 'ADMIN' && role !== 'MEMBER') {
      res.status(400).json({ error: 'תפקיד לא תקין' }); return;
    }

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) { res.status(404).json({ error: 'טיול לא נמצא' }); return; }

    const admin = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId: id } },
    });
    if (!admin)                { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }
    if (admin.role !== 'ADMIN') { res.status(403).json({ error: 'רק מנהל יכול לשנות תפקידים' }); return; }
    if (targetUserId === trip.ownerId) { res.status(400).json({ error: 'לא ניתן לשנות את תפקיד מייסד הטיול' }); return; }
    if (targetUserId === req.userId)  { res.status(400).json({ error: 'לא ניתן לשנות את התפקיד שלך' }); return; }

    const updated = await prisma.tripMember.update({
      where: { userId_tripId: { userId: targetUserId, tripId: id } },
      data: { role },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    res.json({ member: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בשינוי תפקיד' });
  }
};

export const updateTripCurrency = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { defaultCurrency } = req.body as { defaultCurrency: string };

    if (!defaultCurrency) { res.status(400).json({ error: 'חסר מטבע' }); return; }

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId: id } },
    });
    if (!member)               { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }
    if (member.role !== 'ADMIN') { res.status(403).json({ error: 'רק מנהל הטיול יכול לשנות מטבע ברירת מחדל' }); return; }

    const trip = await prisma.trip.update({
      where: { id },
      data: { defaultCurrency },
    });
    res.json({ trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון מטבע' });
  }
};

export const getTripMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) {
      res.status(404).json({ error: 'טיול לא נמצא' });
      return;
    }

    const members = await prisma.tripMember.findMany({
      where: { tripId: id },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    const isMember = members.some((m) => m.userId === req.userId);
    if (!isMember) {
      res.status(403).json({ error: 'אין לך גישה לטיול זה' });
      return;
    }

    res.json({ members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת חברי הטיול' });
  }
};
