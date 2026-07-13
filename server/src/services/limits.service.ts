/**
 * Subscription limits enforcement + usage tracking.
 */

import { prisma } from '../lib/prisma';
import {
  PlanId,
  currentPeriod,
  formatBytes,
  getPlanAsync,
  loadPlans,
} from '../config/plans';

export class LimitError extends Error {
  status = 403;
  code: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export async function getUserPlanRow(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      planExpiresAt: true,
      storageBytesUsed: true,
      aiEnabled: true,
    },
  });
  if (!user) throw new LimitError('USER_NOT_FOUND', 'משתמש לא נמצא');

  // Expired paid plan → fall back to FREE
  let planId = user.plan as PlanId;
  if (
    planId !== 'FREE' &&
    user.planExpiresAt &&
    user.planExpiresAt.getTime() < Date.now()
  ) {
    planId = 'FREE';
  }

  return { user, plan: await getPlanAsync(planId), planId };
}

async function getOrCreateUsage(userId: string, period = currentPeriod()) {
  return prisma.usageMonth.upsert({
    where: { userId_period: { userId, period } },
    create: { userId, period, aiCalls: 0, storageBytesAdded: BigInt(0) },
    update: {},
  });
}

export async function getUsageSnapshot(userId: string) {
  const { user, plan, planId } = await getUserPlanRow(userId);
  const period = currentPeriod();
  const usage = await getOrCreateUsage(userId, period);

  const ownedTrips = await prisma.trip.count({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId, role: 'ADMIN' } } },
      ],
    },
  });

  // Count distinct trips where user is admin (for display)
  const adminTripCount = await prisma.tripMember.count({
    where: { userId, role: 'ADMIN' },
  });

  const tripsUsed = Math.max(ownedTrips, adminTripCount);

  return {
    plan: {
      id: planId,
      nameHe: plan.nameHe,
      expiresAt: user.planExpiresAt,
      limits: {
        maxTrips: plan.maxTrips,
        maxMembersPerTrip: plan.maxMembersPerTrip,
        maxAiCallsPerMonth: plan.maxAiCallsPerMonth,
        maxStorageBytes: plan.maxStorageBytes,
        aiIncluded: plan.aiIncluded,
      },
    },
    usage: {
      period,
      trips: tripsUsed,
      aiCalls: usage.aiCalls,
      storageBytes: Number(user.storageBytesUsed),
      storageBytesAddedThisMonth: Number(usage.storageBytesAdded),
    },
    remaining: {
      trips: Math.max(0, plan.maxTrips - tripsUsed),
      aiCalls: Math.max(0, plan.maxAiCallsPerMonth - usage.aiCalls),
      storageBytes: Math.max(0, plan.maxStorageBytes - Number(user.storageBytesUsed)),
    },
    formatted: {
      storageUsed: formatBytes(user.storageBytesUsed),
      storageLimit: formatBytes(plan.maxStorageBytes),
      storageRemaining: formatBytes(
        Math.max(0, plan.maxStorageBytes - Number(user.storageBytesUsed)),
      ),
    },
    preference: {
      aiEnabled: user.aiEnabled,
    },
    catalog: Object.values(await loadPlans()).map((p) => ({
      id: p.id,
      nameHe: p.nameHe,
      maxTrips: p.maxTrips,
      maxMembersPerTrip: p.maxMembersPerTrip,
      maxAiCallsPerMonth: p.maxAiCallsPerMonth,
      maxStorageBytes: p.maxStorageBytes,
      maxStorageLabel: formatBytes(p.maxStorageBytes),
      aiIncluded: p.aiIncluded,
    })),
  };
}

// ─── Asserts ──────────────────────────────────────────────────────────────────

export async function assertCanCreateTrip(userId: string): Promise<void> {
  const snap = await getUsageSnapshot(userId);
  if (snap.usage.trips >= snap.plan.limits.maxTrips) {
    throw new LimitError(
      'TRIP_LIMIT',
      `הגעת למקסימום טיולים בתוכנית ${snap.plan.nameHe} (${snap.plan.limits.maxTrips}). שדרג כדי ליצור עוד.`,
      { used: snap.usage.trips, limit: snap.plan.limits.maxTrips, plan: snap.plan.id },
    );
  }
}

export async function assertCanAddMember(
  tripId: string,
  actingUserId?: string,
): Promise<void> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      ownerId: true,
      members: { select: { userId: true, role: true } },
    },
  });
  if (!trip) throw new LimitError('TRIP_NOT_FOUND', 'טיול לא נמצא');

  // Limit is based on trip owner's plan (or first admin)
  let ownerId = trip.ownerId;
  if (!ownerId) {
    const admin = trip.members.find((m) => m.role === 'ADMIN');
    ownerId = admin?.userId || actingUserId || '';
  }
  if (!ownerId) return;

  const { plan } = await getUserPlanRow(ownerId);
  const count = trip.members.length;
  if (count >= plan.maxMembersPerTrip) {
    throw new LimitError(
      'MEMBER_LIMIT',
      `הטיול מלא — מקסימום ${plan.maxMembersPerTrip} חברים בתוכנית ${plan.nameHe}.`,
      { used: count, limit: plan.maxMembersPerTrip, plan: plan.id },
    );
  }
}

export async function assertCanUseAi(userId: string, tripId?: string): Promise<void> {
  const { user, plan, planId } = await getUserPlanRow(userId);

  if (!plan.aiIncluded) {
    throw new LimitError(
      'AI_NOT_IN_PLAN',
      `תוכנית ${plan.nameHe} לא כוללת AI. שדרג ל-Pro.`,
      { plan: planId },
    );
  }

  if (!user.aiEnabled) {
    throw new LimitError('AI_USER_OFF', 'כיבית את ה-AI בהגדרות הפרופיל.', {
      plan: planId,
    });
  }

  if (tripId) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { aiEnabled: true },
    });
    if (trip && !trip.aiEnabled) {
      throw new LimitError('AI_TRIP_OFF', 'AI כבוי לטיול זה (הגדרות מנהל).', {
        plan: planId,
      });
    }
  }

  const usage = await getOrCreateUsage(userId);
  if (usage.aiCalls >= plan.maxAiCallsPerMonth) {
    throw new LimitError(
      'AI_QUOTA',
      `ניצלת את מכסת ה-AI לחודש זה (${plan.maxAiCallsPerMonth} קריאות בתוכנית ${plan.nameHe}).`,
      {
        used: usage.aiCalls,
        limit: plan.maxAiCallsPerMonth,
        period: usage.period,
        plan: planId,
      },
    );
  }
}

export async function recordAiCall(userId: string, count = 1): Promise<void> {
  const period = currentPeriod();
  await prisma.usageMonth.upsert({
    where: { userId_period: { userId, period } },
    create: {
      userId,
      period,
      aiCalls: count,
      storageBytesAdded: BigInt(0),
    },
    update: { aiCalls: { increment: count } },
  });
}

export async function assertCanUpload(
  userId: string,
  extraBytes: number,
): Promise<void> {
  if (extraBytes <= 0) return;
  const { user, plan, planId } = await getUserPlanRow(userId);
  const used = Number(user.storageBytesUsed);
  if (used + extraBytes > plan.maxStorageBytes) {
    throw new LimitError(
      'STORAGE_LIMIT',
      `אין מספיק מקום אחסון (בשימוש ${formatBytes(used)} מתוך ${formatBytes(plan.maxStorageBytes)} בתוכנית ${plan.nameHe}).`,
      {
        used,
        limit: plan.maxStorageBytes,
        needed: extraBytes,
        plan: planId,
      },
    );
  }
}

export async function recordStorageDelta(
  userId: string,
  deltaBytes: number,
): Promise<void> {
  if (!deltaBytes) return;
  const period = currentPeriod();

  await prisma.user.update({
    where: { id: userId },
    data: {
      storageBytesUsed: {
        increment: BigInt(deltaBytes),
      },
    },
  });

  // Clamp at 0 if over-decremented
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { storageBytesUsed: true },
  });
  if (u && u.storageBytesUsed < BigInt(0)) {
    await prisma.user.update({
      where: { id: userId },
      data: { storageBytesUsed: BigInt(0) },
    });
  }

  if (deltaBytes > 0) {
    await prisma.usageMonth.upsert({
      where: { userId_period: { userId, period } },
      create: {
        userId,
        period,
        aiCalls: 0,
        storageBytesAdded: BigInt(deltaBytes),
      },
      update: { storageBytesAdded: { increment: BigInt(deltaBytes) } },
    });
  }
}

export function limitErrorPayload(err: LimitError) {
  return {
    error: err.message,
    code: err.code,
    limit: err.details,
  };
}
