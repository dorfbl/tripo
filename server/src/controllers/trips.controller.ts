import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const ADMIN_EMAILS = ['test@test.com', 'dorfbl@gmail.com'];

export const createTrip = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, startDate, endDate } = req.body;

    // רק מנהלי מערכת יכולים ליצור טיולים
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user || !ADMIN_EMAILS.includes(user.email)) {
      res.status(403).json({ error: 'רק מנהלי מערכת יכולים ליצור טיולים חדשים' });
      return;
    }

    if (!name) {
      res.status(400).json({ error: 'שם הטיול הוא שדה חובה' });
      return;
    }

    const trip = await prisma.trip.create({
      data: {
        name,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
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
        _count: { select: { destinations: true } },
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
        destinations: {
          include: {
            votes: { select: { userId: true, score: true } },
          },
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
