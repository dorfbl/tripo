import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import {
  getUsageSnapshot,
  LimitError,
  limitErrorPayload,
} from '../services/limits.service';
import {
  PlanId,
  DEFAULT_PLANS,
  ensurePlanConfigs,
  invalidatePlanCache,
  loadPlans,
  formatBytes,
  currentPeriod,
} from '../config/plans';
import { isSuperAdmin, requireSuperAdmin } from '../lib/superAdmin';

export const getMySubscription = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const snap = await getUsageSnapshot(req.userId!);
    const superAdmin = await isSuperAdmin(req.userId!);
    res.json({ ...snap, isSuperAdmin: superAdmin });
  } catch (err) {
    if (err instanceof LimitError) {
      res.status(err.status).json(limitErrorPayload(err));
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת מנוי' });
  }
};

/** Self-service: only FREE/PRO for normal users; super admin any plan for self */
export const setMyPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { plan, days } = req.body as { plan?: string; days?: number };
    if (!plan || !(plan in DEFAULT_PLANS)) {
      res.status(400).json({ error: 'תוכנית לא תקינה (FREE / PRO / BUSINESS)' });
      return;
    }

    const superAdmin = await isSuperAdmin(req.userId!);
    if (!superAdmin && plan === 'BUSINESS') {
      res.status(403).json({ error: 'רק סופר־אדמין יכול לבחור Business' });
      return;
    }

    const expires =
      plan === 'FREE'
        ? null
        : new Date(Date.now() + (days && days > 0 ? days : 30) * 86400000);

    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        plan: plan as PlanId,
        planExpiresAt: expires,
      },
      select: {
        id: true,
        email: true,
        plan: true,
        planExpiresAt: true,
      },
    });

    const snap = await getUsageSnapshot(req.userId!);
    res.json({ user, subscription: snap });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון תוכנית' });
  }
};

// ─── Super admin ──────────────────────────────────────────────────────────────

export const adminListUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await requireSuperAdmin(req.userId!);
    await ensurePlanConfigs();

    const q = String(req.query.q || '').trim().toLowerCase();
    const period = currentPeriod();

    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        planExpiresAt: true,
        aiEnabled: true,
        storageBytesUsed: true,
        createdAt: true,
        usageMonths: {
          where: { period },
          select: { aiCalls: true, period: true },
        },
        _count: {
          select: {
            trips: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Admin trip counts (more accurate for limits)
    const adminCounts = await prisma.tripMember.groupBy({
      by: ['userId'],
      where: { role: 'ADMIN' },
      _count: { userId: true },
    });
    const adminMap = Object.fromEntries(
      adminCounts.map((r) => [r.userId, r._count.userId]),
    );

    res.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        plan: u.plan,
        planExpiresAt: u.planExpiresAt,
        aiEnabled: u.aiEnabled,
        storageBytesUsed: Number(u.storageBytesUsed),
        storageLabel: formatBytes(u.storageBytesUsed),
        aiCallsThisMonth: u.usageMonths[0]?.aiCalls ?? 0,
        period,
        tripsAsAdmin: adminMap[u.id] ?? 0,
        createdAt: u.createdAt,
      })),
    });
  } catch (err: any) {
    if (err?.code === 'SUPER_ADMIN_ONLY' || err?.status === 403) {
      res.status(403).json({ error: err.message || 'אין הרשאה' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת משתמשים' });
  }
};

export const adminSetUserPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await requireSuperAdmin(req.userId!);

    const { userId } = req.params as { userId: string };
    const { plan, days, planExpiresAt, aiEnabled } = req.body as {
      plan?: string;
      days?: number | null;
      planExpiresAt?: string | null;
      aiEnabled?: boolean;
    };

    if (plan !== undefined && !(plan in DEFAULT_PLANS)) {
      res.status(400).json({ error: 'תוכנית לא תקינה' });
      return;
    }

    let expires: Date | null | undefined = undefined;
    if (planExpiresAt === null) expires = null;
    else if (typeof planExpiresAt === 'string' && planExpiresAt) {
      expires = new Date(planExpiresAt);
      if (Number.isNaN(expires.getTime())) {
        res.status(400).json({ error: 'תאריך תפוגה לא תקין' });
        return;
      }
    } else if (plan !== undefined) {
      if (plan === 'FREE') expires = null;
      else if (days === null) expires = null; // never expires
      else expires = new Date(Date.now() + (days && days > 0 ? days : 30) * 86400000);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(plan !== undefined && { plan: plan as PlanId }),
        ...(expires !== undefined && { planExpiresAt: expires }),
        ...(aiEnabled !== undefined && { aiEnabled: Boolean(aiEnabled) }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        planExpiresAt: true,
        aiEnabled: true,
        storageBytesUsed: true,
      },
    });

    res.json({
      user: {
        ...user,
        storageBytesUsed: Number(user.storageBytesUsed),
      },
    });
  } catch (err: any) {
    if (err?.code === 'SUPER_ADMIN_ONLY' || err?.status === 403) {
      res.status(403).json({ error: err.message || 'אין הרשאה' });
      return;
    }
    if (err?.code === 'P2025') {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון משתמש' });
  }
};

export const adminGetPlanConfigs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await requireSuperAdmin(req.userId!);
    await ensurePlanConfigs();
    const plans = await loadPlans();
    res.json({
      plans: Object.values(plans).map((p) => ({
        ...p,
        maxStorageLabel: formatBytes(p.maxStorageBytes),
      })),
    });
  } catch (err: any) {
    if (err?.code === 'SUPER_ADMIN_ONLY' || err?.status === 403) {
      res.status(403).json({ error: err.message || 'אין הרשאה' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת תוכניות' });
  }
};

export const adminUpdatePlanConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await requireSuperAdmin(req.userId!);

    const { planId } = req.params as { planId: string };
    if (!(planId in DEFAULT_PLANS)) {
      res.status(400).json({ error: 'מזהה תוכנית לא תקין' });
      return;
    }

    const {
      nameHe,
      maxTrips,
      maxMembersPerTrip,
      maxAiCallsPerMonth,
      maxStorageBytes,
      maxStorageMb,
      aiIncluded,
    } = req.body;

    const storage =
      maxStorageBytes != null
        ? Number(maxStorageBytes)
        : maxStorageMb != null
          ? Math.round(Number(maxStorageMb) * 1024 * 1024)
          : undefined;

    if (maxTrips != null && Number(maxTrips) < 0) {
      res.status(400).json({ error: 'maxTrips לא תקין' });
      return;
    }

    await ensurePlanConfigs();

    const updated = await prisma.planConfig.update({
      where: { id: planId },
      data: {
        ...(nameHe != null && { nameHe: String(nameHe) }),
        ...(maxTrips != null && { maxTrips: Number(maxTrips) }),
        ...(maxMembersPerTrip != null && { maxMembersPerTrip: Number(maxMembersPerTrip) }),
        ...(maxAiCallsPerMonth != null && { maxAiCallsPerMonth: Number(maxAiCallsPerMonth) }),
        ...(storage != null && { maxStorageBytes: BigInt(Math.max(0, storage)) }),
        ...(aiIncluded != null && { aiIncluded: Boolean(aiIncluded) }),
      },
    });

    invalidatePlanCache();

    res.json({
      plan: {
        id: updated.id,
        nameHe: updated.nameHe,
        maxTrips: updated.maxTrips,
        maxMembersPerTrip: updated.maxMembersPerTrip,
        maxAiCallsPerMonth: updated.maxAiCallsPerMonth,
        maxStorageBytes: Number(updated.maxStorageBytes),
        maxStorageLabel: formatBytes(updated.maxStorageBytes),
        aiIncluded: updated.aiIncluded,
      },
    });
  } catch (err: any) {
    if (err?.code === 'SUPER_ADMIN_ONLY' || err?.status === 403) {
      res.status(403).json({ error: err.message || 'אין הרשאה' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון תוכנית' });
  }
};
