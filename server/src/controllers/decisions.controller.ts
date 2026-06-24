import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const includeDecision = {
  options: { orderBy: { createdAt: 'asc' } as const },
  votes: {
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  },
  createdBy: { select: { id: true, name: true, avatarUrl: true } },
};

async function getMember(tripId: string, userId: string) {
  return prisma.tripMember.findFirst({ where: { tripId, userId } });
}

// GET /api/decisions/:tripId
export const getDecisions = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const userId = req.userId!;

    const member = await getMember(tripId, userId);
    if (!member) return res.status(403).json({ error: 'אין גישה לטיול זה' });

    const decisions = await prisma.decision.findMany({
      where: { tripId },
      include: includeDecision,
      orderBy: { createdAt: 'desc' },
    });

    res.json(decisions);
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת ההחלטות' });
  }
};

// POST /api/decisions/:tripId
export const createDecision = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const userId = req.userId!;
    const { title, description, category, type, options, dueDate, isSecretVote, hideResultsUntilClosed } = req.body;

    const member = await getMember(tripId, userId);
    if (!member) return res.status(403).json({ error: 'אין גישה לטיול זה' });

    if (!title?.trim()) return res.status(400).json({ error: 'כותרת שדה חובה' });
    if (!type) return res.status(400).json({ error: 'סוג שדה חובה' });

    const validTypes = ['YES_NO', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'TOP3'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'סוג לא תקין' });

    let optionTexts: string[] = Array.isArray(options) ? options.filter(Boolean) : [];
    if (type === 'YES_NO') optionTexts = ['כן', 'לא'];

    const validCategories = ['DESTINATION', 'DATES', 'HOTEL', 'TRANSPORT', 'ACTIVITY', 'BUDGET', 'OTHER'];
    const cat = (category?.toUpperCase() ?? 'OTHER');
    const finalCategory = validCategories.includes(cat) ? cat : 'OTHER';

    const decision = await prisma.decision.create({
      data: {
        tripId,
        title: title.trim(),
        description: description?.trim() || null,
        category: finalCategory as any,
        type: type as any,
        status: 'VOTING',
        isSecretVote: Boolean(isSecretVote),
        hideResultsUntilClosed: Boolean(hideResultsUntilClosed),
        createdByUserId: userId,
        dueDate: dueDate ? new Date(dueDate) : null,
        options: optionTexts.length > 0 ? {
          create: optionTexts.map((text: string) => ({ text: text.trim() })),
        } : undefined,
      },
      include: includeDecision,
    });

    res.status(201).json(decision);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה ביצירת ההחלטה' });
  }
};

// PUT /api/decisions/:decisionId/close
export const closeDecision = async (req: AuthRequest, res: Response) => {
  try {
    const { decisionId } = req.params;
    const userId = req.userId!;
    const { finalDecision, finalOptionId, actionNote } = req.body;

    const decision = await prisma.decision.findUnique({
      where: { id: decisionId },
      include: { trip: { include: { members: true } } },
    });
    if (!decision) return res.status(404).json({ error: 'החלטה לא נמצאה' });

    const member = decision.trip.members.find(m => m.userId === userId);
    if (!member) return res.status(403).json({ error: 'אין גישה' });
    if (decision.createdByUserId !== userId && member.role !== 'ADMIN') {
      return res.status(403).json({ error: 'רק יוצר ההחלטה או מנהל יכולים לסגור' });
    }

    const updated = await prisma.decision.update({
      where: { id: decisionId },
      data: {
        status: 'DECIDED',
        finalDecision: finalDecision?.trim() || null,
        finalOptionId: finalOptionId || null,
        actionNote: actionNote?.trim() || null,
        decidedAt: new Date(),
      },
      include: includeDecision,
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'שגיאה בסגירת ההחלטה' });
  }
};

// PUT /api/decisions/:decisionId/reopen
export const reopenDecision = async (req: AuthRequest, res: Response) => {
  try {
    const { decisionId } = req.params;
    const userId = req.userId!;

    const decision = await prisma.decision.findUnique({
      where: { id: decisionId },
      include: { trip: { include: { members: true } }, options: true },
    });
    if (!decision) return res.status(404).json({ error: 'החלטה לא נמצאה' });

    const member = decision.trip.members.find(m => m.userId === userId);
    if (!member || member.role !== 'ADMIN') {
      return res.status(403).json({ error: 'רק מנהל יכול לפתוח מחדש' });
    }

    const updated = await prisma.decision.update({
      where: { id: decisionId },
      data: {
        status: 'VOTING',
        finalDecision: null,
        finalOptionId: null,
        decidedAt: null,
        actionNote: null,
      },
      include: includeDecision,
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'שגיאה בפתיחת ההחלטה' });
  }
};

// DELETE /api/decisions/:decisionId
export const deleteDecision = async (req: AuthRequest, res: Response) => {
  try {
    const { decisionId } = req.params;
    const userId = req.userId!;

    const decision = await prisma.decision.findUnique({
      where: { id: decisionId },
      include: { trip: { include: { members: true } } },
    });
    if (!decision) return res.status(404).json({ error: 'החלטה לא נמצאה' });

    const member = decision.trip.members.find(m => m.userId === userId);
    if (!member || member.role !== 'ADMIN') {
      return res.status(403).json({ error: 'רק מנהל יכול למחוק' });
    }

    await prisma.decision.delete({ where: { id: decisionId } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'שגיאה במחיקת ההחלטה' });
  }
};

// POST /api/decisions/:decisionId/vote
export const castVote = async (req: AuthRequest, res: Response) => {
  try {
    const { decisionId } = req.params;
    const userId = req.userId!;
    const { optionId } = req.body;

    const decision = await prisma.decision.findUnique({
      where: { id: decisionId },
      include: { trip: { include: { members: true } } },
    });
    if (!decision) return res.status(404).json({ error: 'החלטה לא נמצאה' });
    if (decision.status === 'DECIDED') return res.status(400).json({ error: 'ההחלטה כבר נסגרה' });

    const member = decision.trip.members.find(m => m.userId === userId);
    if (!member) return res.status(403).json({ error: 'אין גישה' });

    if (decision.type !== 'TOP3' && !optionId) return res.status(400).json({ error: 'optionId שדה חובה' });

    if (decision.type === 'TOP3') {
      // body: { votes: [{optionId, rank}] } — replaces all user votes at once
      const { votes } = req.body;
      await prisma.decisionVote.deleteMany({ where: { decisionId, userId } });
      if (Array.isArray(votes) && votes.length > 0) {
        const valid = votes
          .filter((v: any) => v.optionId && v.rank >= 1 && v.rank <= 3)
          .slice(0, 3);
        for (const v of valid) {
          await prisma.decisionVote.create({ data: { decisionId, optionId: v.optionId, userId, rank: v.rank } });
        }
      }
    } else if (decision.type === 'MULTI_CHOICE') {
      // Toggle: if vote for this option exists → remove; else → add
      const existing = await prisma.decisionVote.findUnique({
        where: { decisionId_optionId_userId: { decisionId, optionId, userId } },
      });
      if (existing) {
        await prisma.decisionVote.delete({
          where: { decisionId_optionId_userId: { decisionId, optionId, userId } },
        });
      } else {
        await prisma.decisionVote.create({ data: { decisionId, optionId, userId } });
      }
    } else {
      // SINGLE_CHOICE / YES_NO: toggle off if same option, otherwise replace
      const existing = await prisma.decisionVote.findFirst({ where: { decisionId, userId } });
      if (existing?.optionId === optionId) {
        await prisma.decisionVote.delete({ where: { id: existing.id } });
      } else {
        await prisma.decisionVote.deleteMany({ where: { decisionId, userId } });
        await prisma.decisionVote.create({ data: { decisionId, optionId, userId } });
      }
    }

    const updated = await prisma.decision.findUnique({
      where: { id: decisionId },
      include: includeDecision,
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'שגיאה בהצבעה' });
  }
};

// POST /api/decisions/:decisionId/options
export const addOption = async (req: AuthRequest, res: Response) => {
  try {
    const { decisionId } = req.params;
    const userId = req.userId!;
    const { text } = req.body;

    if (!text?.trim()) return res.status(400).json({ error: 'טקסט אפשרות שדה חובה' });

    const decision = await prisma.decision.findUnique({
      where: { id: decisionId },
      include: { trip: { include: { members: true } } },
    });
    if (!decision) return res.status(404).json({ error: 'החלטה לא נמצאה' });
    if (decision.status === 'DECIDED') return res.status(400).json({ error: 'ההחלטה כבר נסגרה' });

    const member = decision.trip.members.find(m => m.userId === userId);
    if (!member) return res.status(403).json({ error: 'אין גישה' });

    await prisma.decisionOption.create({ data: { decisionId, text: text.trim() } });

    const updated = await prisma.decision.findUnique({
      where: { id: decisionId },
      include: includeDecision,
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'שגיאה בהוספת אפשרות' });
  }
};
