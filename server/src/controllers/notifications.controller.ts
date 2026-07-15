import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { generateSmartNotificationsForUser } from '../services/notifications.service';
import { isAiConfigured } from '../services/ai.service';

export const listNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '40'), 10) || 40, 1), 100);
    const unreadOnly = String(req.query.unread || '') === '1';
    const tripId = req.query.tripId ? String(req.query.tripId) : null;

    // Drop stale hours alerts + duplicate/resolved smart tips (hotel/flight/weather etc.)
    try {
      const {
        purgeStaleHoursNotifications,
        purgeDuplicateSmartNotifications,
        purgeResolvedSmartNotifications,
      } = await import('../services/notifications.service');
      if (tripId) {
        await Promise.all([
          purgeStaleHoursNotifications({ tripId, userId }),
          purgeDuplicateSmartNotifications({ tripId, userId }),
          purgeResolvedSmartNotifications({ tripId, userId }),
        ]);
      } else {
        // Active trips for this user (cap) — keep list snappy
        const memberships = await prisma.tripMember.findMany({
          where: { userId },
          select: { tripId: true },
          take: 8,
          orderBy: { joinedAt: 'desc' },
        });
        await Promise.all(
          memberships.flatMap((m) => [
            purgeStaleHoursNotifications({ tripId: m.tripId, userId }),
            purgeDuplicateSmartNotifications({ tripId: m.tripId, userId }),
            purgeResolvedSmartNotifications({ tripId: m.tripId, userId }),
          ]),
        );
      }
    } catch (err) {
      console.warn('[notifications] purge on list failed:', err);
    }

    // If tripId provided, only that trip (active-trip mode)
    const tripFilter = tripId ? { tripId } : {};

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        ...tripFilter,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        trip: { select: { id: true, name: true } },
      },
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false, ...tripFilter },
    });

    res.json({ notifications, unreadCount, aiConfigured: isAiConfigured() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת התראות' });
  }
};

export const markRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params as { id: string };

    const n = await prisma.notification.findFirst({ where: { id, userId } });
    if (!n) {
      res.status(404).json({ error: 'התראה לא נמצאה' });
      return;
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון התראה' });
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params as { id: string };

    const n = await prisma.notification.findFirst({ where: { id, userId } });
    if (!n) {
      res.status(404).json({ error: 'התראה לא נמצאה' });
      return;
    }

    await prisma.notification.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה במחיקת התראה' });
  }
};

export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    // Accept tripId from query or body
    const tripId =
      (req.query.tripId ? String(req.query.tripId) : null) ||
      (req.body?.tripId ? String(req.body.tripId) : null);

    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        ...(tripId ? { tripId } : {}),
      },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון התראות' });
  }
};

/** Generate smart (AI if enabled) notifications for active trip */
export const generateSmart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { tripId } = req.params as { tripId: string };

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId, tripId } },
    });
    if (!member) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    const result = await generateSmartNotificationsForUser(tripId, userId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה ביצירת התראות חכמות' });
  }
};

/** Delete all smart notifications for user+trip (cleanup utility) */
export const deleteSmartNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { tripId } = req.params as { tripId: string };

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId, tripId } },
    });
    if (!member) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    const result = await prisma.notification.deleteMany({
      where: {
        userId,
        tripId,
        metadata: { path: ['kind'], equals: 'smart' },
      },
    });

    res.json({ deleted: result.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה במחיקת התראות' });
  }
};
