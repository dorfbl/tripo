/**
 * Subscription plan limits for TRIPO.
 * Defaults live here; super-admin can override via PlanConfig table.
 */

import { prisma } from '../lib/prisma';

export type PlanId = 'FREE' | 'PRO' | 'BUSINESS';

export interface PlanLimits {
  id: PlanId;
  nameHe: string;
  /** Max trips the user may own (ownerId / ADMIN creator) */
  maxTrips: number;
  /** Max members in a trip owned by this user */
  maxMembersPerTrip: number;
  /** AI API calls per calendar month (recaps, smart notifications polish, etc.) */
  maxAiCallsPerMonth: number;
  /** Total storage for uploads attributed to this user (bytes) */
  maxStorageBytes: number;
  /** Whether plan includes AI features at all */
  aiIncluded: boolean;
}

export const DEFAULT_PLANS: Record<PlanId, PlanLimits> = {
  FREE: {
    id: 'FREE',
    nameHe: 'חינם',
    maxTrips: 2,
    maxMembersPerTrip: 6,
    maxAiCallsPerMonth: 10,
    maxStorageBytes: 50 * 1024 * 1024, // 50 MB
    aiIncluded: true,
  },
  PRO: {
    id: 'PRO',
    nameHe: 'Pro',
    maxTrips: 15,
    maxMembersPerTrip: 20,
    maxAiCallsPerMonth: 150,
    maxStorageBytes: 2 * 1024 * 1024 * 1024, // 2 GB
    aiIncluded: true,
  },
  BUSINESS: {
    id: 'BUSINESS',
    nameHe: 'Business',
    maxTrips: 100,
    maxMembersPerTrip: 50,
    maxAiCallsPerMonth: 1000,
    maxStorageBytes: 20 * 1024 * 1024 * 1024, // 20 GB
    aiIncluded: true,
  },
};

/** @deprecated use DEFAULT_PLANS or getPlanAsync — kept for sync fallbacks */
export const PLANS = DEFAULT_PLANS;

let cache: { at: number; plans: Record<PlanId, PlanLimits> } | null = null;
const CACHE_MS = 15_000;

export async function loadPlans(): Promise<Record<PlanId, PlanLimits>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.plans;

  const plans: Record<PlanId, PlanLimits> = {
    FREE: { ...DEFAULT_PLANS.FREE },
    PRO: { ...DEFAULT_PLANS.PRO },
    BUSINESS: { ...DEFAULT_PLANS.BUSINESS },
  };

  try {
    const rows = await prisma.planConfig.findMany();
    for (const row of rows) {
      if (row.id in plans) {
        const id = row.id as PlanId;
        plans[id] = {
          id,
          nameHe: row.nameHe,
          maxTrips: row.maxTrips,
          maxMembersPerTrip: row.maxMembersPerTrip,
          maxAiCallsPerMonth: row.maxAiCallsPerMonth,
          maxStorageBytes: Number(row.maxStorageBytes),
          aiIncluded: row.aiIncluded,
        };
      }
    }
  } catch {
    // table may not exist yet during migrate
  }

  cache = { at: Date.now(), plans };
  return plans;
}

export function invalidatePlanCache() {
  cache = null;
}

export function getPlan(plan: string | null | undefined): PlanLimits {
  if (plan && plan in DEFAULT_PLANS) return DEFAULT_PLANS[plan as PlanId];
  return DEFAULT_PLANS.FREE;
}

export async function getPlanAsync(plan: string | null | undefined): Promise<PlanLimits> {
  const all = await loadPlans();
  if (plan && plan in all) return all[plan as PlanId];
  return all.FREE;
}

/** Ensure PlanConfig rows exist (seed defaults) */
export async function ensurePlanConfigs(): Promise<void> {
  for (const p of Object.values(DEFAULT_PLANS)) {
    await prisma.planConfig.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        nameHe: p.nameHe,
        maxTrips: p.maxTrips,
        maxMembersPerTrip: p.maxMembersPerTrip,
        maxAiCallsPerMonth: p.maxAiCallsPerMonth,
        maxStorageBytes: BigInt(p.maxStorageBytes),
        aiIncluded: p.aiIncluded,
      },
      update: {},
    });
  }
  invalidatePlanCache();
}

export function formatBytes(n: number | bigint): string {
  const v = Number(n);
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  if (v < 1024 * 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`;
  return `${(v / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
