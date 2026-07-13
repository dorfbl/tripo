export type PlanTier = 'FREE' | 'PRO' | 'BUSINESS';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  /** Personal AI preference for timeline + notifications */
  aiEnabled?: boolean;
  plan?: PlanTier;
  planExpiresAt?: string | null;
  storageBytesUsed?: number;
}

export interface SubscriptionSnapshot {
  plan: {
    id: PlanTier;
    nameHe: string;
    expiresAt: string | null;
    limits: {
      maxTrips: number;
      maxMembersPerTrip: number;
      maxAiCallsPerMonth: number;
      maxStorageBytes: number;
      aiIncluded: boolean;
    };
  };
  usage: {
    period: string;
    trips: number;
    aiCalls: number;
    storageBytes: number;
  };
  remaining: {
    trips: number;
    aiCalls: number;
    storageBytes: number;
  };
  formatted: {
    storageUsed: string;
    storageLimit: string;
    storageRemaining: string;
  };
  preference: { aiEnabled: boolean };
  catalog: Array<{
    id: PlanTier;
    nameHe: string;
    maxTrips: number;
    maxMembersPerTrip: number;
    maxAiCallsPerMonth: number;
    maxStorageBytes: number;
    maxStorageLabel: string;
    aiIncluded: boolean;
  }>;
}

export interface Trip {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  inviteCode: string;
  defaultCurrency: string;
  ownerId: string;
  /** Trip-level AI switch (admin) */
  aiEnabled?: boolean;
  createdAt: string;
  members: TripMember[];
}

export interface AppNotification {
  id: string;
  userId: string;
  tripId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  emoji: string;
  href?: string | null;
  isRead: boolean;
  aiGenerated: boolean;
  createdAt: string;
  trip?: { id: string; name: string } | null;
}

export type TripStatus = 'PLAN' | 'LIVE' | 'FINISHED' | 'CANCELED';

export interface TripMember {
  id: string;
  userId: string;
  tripId: string;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: string;
  completedQuestionnaire: boolean;
  user: { id: string; name: string; email?: string; avatarUrl?: string | null };
}

// ===== קישורים =====

export type TripLinkType = 'FLIGHT'|'HOTEL'|'CAR'|'ACTIVITY'|'RESTAURANT'|'BAR'|'MAP'|'INSURANCE'|'DOCUMENT'|'PAYMENT'|'OTHER';
export type TripLinkStatus = 'SAVED'|'PENDING'|'BOOKED'|'PAID'|'MISSING'|'CANCELLED';

export interface TripLink {
  id: string;
  tripId: string;
  title: string;
  description?: string | null;
  url?: string | null;
  type: TripLinkType;
  status: TripLinkStatus;
  providerName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  estimatedCost?: number | null;
  currency?: string | null;
  notes?: string | null;
  isPinned: boolean;
  isPrivate: boolean;
  fileUrl?: string | null;
  fileName?: string | null;
  decisionId?: string | null;
  createdByUserId: string;
  createdBy: { id: string; name: string; avatarUrl?: string | null };
  createdAt: string;
  updatedAt: string;
}

// ===== החלטות =====

export type DecisionStatus = 'VOTING' | 'DECIDED';
export type DecisionType = 'YES_NO' | 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'TOP3';
export type DecisionCategory = 'DESTINATION' | 'DATES' | 'HOTEL' | 'TRANSPORT' | 'ACTIVITY' | 'BUDGET' | 'OTHER';

export interface DecisionOption {
  id: string;
  decisionId: string;
  text: string;
  description?: string;
  createdAt: string;
}

export interface DecisionVote {
  id: string;
  decisionId: string;
  optionId: string;
  userId: string;
  rank?: number | null;
  createdAt: string;
  user?: { id: string; name: string; avatarUrl?: string | null };
}

export interface Decision {
  id: string;
  tripId: string;
  title: string;
  description?: string | null;
  category: DecisionCategory;
  status: DecisionStatus;
  type: DecisionType;
  options: DecisionOption[];
  votes: DecisionVote[];
  finalDecision?: string | null;
  finalOptionId?: string | null;
  dueDate?: string | null;
  actionNote?: string | null;
  isSecretVote: boolean;
  hideResultsUntilClosed: boolean;
  createdByUserId: string;
  createdBy: { id: string; name: string; avatarUrl?: string | null };
  createdAt: string;
  updatedAt: string;
  decidedAt?: string | null;
}
