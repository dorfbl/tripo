export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface Trip {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  inviteCode: string;
  defaultCurrency: string;
  createdAt: string;
  members: TripMember[];
  destinations?: SuggestedDestination[];
  _count?: { destinations: number };
}

export type TripStatus = 'PLANNING' | 'VOTING' | 'BOOKED' | 'ONGOING' | 'COMPLETED';

export interface TripMember {
  id: string;
  userId: string;
  tripId: string;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: string;
  completedQuestionnaire: boolean;
  user: { id: string; name: string; email?: string; avatarUrl?: string | null };
}

export interface Question {
  id: string;
  text: string;
  category: string;
  type: 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'SCALE' | 'TEXT';
  order: number;
  options: string[] | null;
  isActive: boolean;
}

export interface QuestionnaireStatus {
  total: number;
  completed: number;
  allCompleted: boolean;
  members: { userId: string; name: string; completed: boolean }[];
}

export interface SuggestedDestination {
  id: string;
  tripId: string;
  name: string;
  country: string;
  description: string;
  whyItFits: string;
  matchScore: number;
  climate: string | null;
  highlights: string[];
  createdAt: string;
  votes: { userId: string; score: number }[];
}

export interface DestinationResult {
  id: string;
  name: string;
  country: string;
  matchScore: number;
  avgVote: number | null;
  totalVotes: number;
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
  createdByUserId: string;
  createdBy: { id: string; name: string; avatarUrl?: string | null };
  createdAt: string;
  updatedAt: string;
  decidedAt?: string | null;
}
