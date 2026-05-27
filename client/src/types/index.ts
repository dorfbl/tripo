export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Trip {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  inviteCode: string;
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
  user: { id: string; name: string; email?: string };
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
