import { Prisma, TimelineEventType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notifyTripMembers } from './notifications.service';

export type TimelineCategory =
  | 'expenses'
  | 'places'
  | 'photos'
  | 'decisions'
  | 'documents'
  | 'members'
  | 'memory'
  | 'ai';

export interface RecordTimelineInput {
  tripId: string;
  type: TimelineEventType;
  category: TimelineCategory;
  title: string;
  description?: string | null;
  emoji?: string;
  isPrivate?: boolean;
  aiGenerated?: boolean;
  createdByUserId?: string | null;
  refType?: string | null;
  refId?: string | null;
  metadata?: Prisma.InputJsonValue;
  occurredAt?: Date;
  /** Also push a notification to trip members (default true for meaningful events) */
  notify?: boolean;
  notifyHref?: string | null;
}

/** Never throws to the caller — timeline logging must not break primary flows */
export async function recordTimelineEvent(input: RecordTimelineInput): Promise<void> {
  try {
    const title = input.title.trim();
    const description = input.description?.trim() || null;
    const aiGenerated = Boolean(input.aiGenerated);

    await prisma.timelineEvent.create({
      data: {
        tripId: input.tripId,
        type: input.type,
        category: input.category,
        title,
        description,
        emoji: input.emoji || '📌',
        isPrivate: Boolean(input.isPrivate),
        aiGenerated,
        createdByUserId: input.createdByUserId || null,
        refType: input.refType || null,
        refId: input.refId || null,
        metadata: input.metadata ?? undefined,
        occurredAt: input.occurredAt || new Date(),
      },
    });

    // In-app notification for members (not AI — instant). AI digests are separate.
    if (input.notify !== false && !input.isPrivate) {
      await notifyTripMembers(
        input.tripId,
        {
          type: input.category === 'ai' ? 'ai' : mapNotifyType(input.type),
          title,
          body: description,
          emoji: input.emoji || '📌',
          href: input.notifyHref || `/trip/${input.tripId}/timeline`,
          aiGenerated: false,
        },
        input.createdByUserId,
      );
    }
  } catch (err) {
    console.error('[timeline] failed to record event:', err);
  }
}

function mapNotifyType(t: TimelineEventType): string {
  switch (t) {
    case 'DECISION_CLOSED':
      return 'decision';
    case 'EXPENSE_ADDED':
      return 'expense';
    case 'MEMBER_JOINED':
      return 'member';
    case 'MEMORY':
    case 'AI_RECAP':
    case 'AI_NOTE':
      return 'memory';
    default:
      return 'system';
  }
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export async function timelineMemberJoined(opts: {
  tripId: string;
  userId: string;
  userName: string;
}) {
  await recordTimelineEvent({
    tripId: opts.tripId,
    type: 'MEMBER_JOINED',
    category: 'members',
    title: `${opts.userName} הצטרף/ה לטיול`,
    emoji: '✈️',
    createdByUserId: opts.userId,
    refType: 'user',
    refId: opts.userId,
  });
}

export async function timelineDecisionClosed(opts: {
  tripId: string;
  userId: string;
  decisionId: string;
  decisionTitle: string;
  finalDecision?: string | null;
}) {
  const desc = opts.finalDecision?.trim()
    ? `החלטה סופית: ${opts.finalDecision.trim()}`
    : null;
  await recordTimelineEvent({
    tripId: opts.tripId,
    type: 'DECISION_CLOSED',
    category: 'decisions',
    title: `החלטה נסגרה: ${opts.decisionTitle}`,
    description: desc,
    emoji: '📊',
    createdByUserId: opts.userId,
    refType: 'decision',
    refId: opts.decisionId,
  });
}

const LINK_TYPE_META: Record<string, { emoji: string; label: string }> = {
  FLIGHT: { emoji: '✈️', label: 'טיסה' },
  HOTEL: { emoji: '🏨', label: 'מלון' },
  CAR: { emoji: '🚗', label: 'רכב' },
  ACTIVITY: { emoji: '🎯', label: 'אטרקציה' },
  RESTAURANT: { emoji: '🍽️', label: 'מסעדה' },
  BAR: { emoji: '🍻', label: 'בר' },
  MAP: { emoji: '🗺️', label: 'מפה' },
  INSURANCE: { emoji: '🛡️', label: 'ביטוח' },
  DOCUMENT: { emoji: '📄', label: 'מסמך' },
  PAYMENT: { emoji: '💳', label: 'תשלום' },
  OTHER: { emoji: '🔗', label: 'קישור' },
};

export async function timelineLinkAdded(opts: {
  tripId: string;
  userId: string;
  linkId: string;
  title: string;
  linkType: string;
  isPrivate?: boolean;
  hasFile?: boolean;
}) {
  const meta = LINK_TYPE_META[opts.linkType] || LINK_TYPE_META.OTHER;
  const noun = opts.hasFile ? 'מסמך' : meta.label;
  await recordTimelineEvent({
    tripId: opts.tripId,
    type: 'LINK_ADDED',
    category: 'documents',
    title: `${noun} נוסף: ${opts.title}`,
    emoji: meta.emoji,
    isPrivate: opts.isPrivate,
    createdByUserId: opts.userId,
    refType: 'link',
    refId: opts.linkId,
    metadata: { linkType: opts.linkType },
  });
}

export async function timelinePlaceAdded(opts: {
  tripId: string;
  userId: string;
  placeId: string;
  placeName: string;
}) {
  await recordTimelineEvent({
    tripId: opts.tripId,
    type: 'PLACE_ADDED',
    category: 'places',
    title: `מקום נוסף: ${opts.placeName}`,
    emoji: '📍',
    createdByUserId: opts.userId,
    refType: 'place',
    refId: opts.placeId,
  });
}

export async function timelineExpenseAdded(opts: {
  tripId: string;
  userId: string;
  expenseId: string;
  description: string;
  amount: number;
  currency: string;
  amountILS: number;
  category?: string;
}) {
  const amountLabel =
    opts.currency === 'ILS'
      ? `₪${opts.amount.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`
      : `${opts.amount.toLocaleString('he-IL', { maximumFractionDigits: 2 })} ${opts.currency}`;

  const isRepayment = opts.category === 'repayment';
  await recordTimelineEvent({
    tripId: opts.tripId,
    type: 'EXPENSE_ADDED',
    category: 'expenses',
    title: isRepayment
      ? `החזר כסף: ${amountLabel}`
      : `הוצאה: ${opts.description} · ${amountLabel}`,
    description: opts.currency !== 'ILS' ? `≈ ₪${opts.amountILS.toLocaleString('he-IL', { maximumFractionDigits: 2 })}` : null,
    emoji: isRepayment ? '💳' : '💶',
    createdByUserId: opts.userId,
    refType: 'expense',
    refId: opts.expenseId,
    metadata: {
      amount: opts.amount,
      currency: opts.currency,
      amountILS: opts.amountILS,
      expenseCategory: opts.category,
    },
  });
}

export async function timelinePhotoUploaded(opts: {
  tripId: string;
  userId: string;
  placeId: string;
  placeName: string;
  photoId: string;
  count?: number;
}) {
  const count = opts.count && opts.count > 1 ? opts.count : 1;
  await recordTimelineEvent({
    tripId: opts.tripId,
    type: 'PHOTO_UPLOADED',
    category: 'photos',
    title:
      count > 1
        ? `${count} תמונות הועלו · ${opts.placeName}`
        : `תמונה הועלתה · ${opts.placeName}`,
    emoji: '📷',
    createdByUserId: opts.userId,
    refType: 'photo',
    refId: opts.photoId,
    metadata: { placeId: opts.placeId, count },
  });
}
