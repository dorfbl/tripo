import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { generateDestinations } from '../services/ai.service';

export const generate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tripId = req.params['tripId'] as string;

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId } },
    });

    if (!member) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    if (member.role !== 'ADMIN') {
      res.status(403).json({ error: 'רק מנהל הטיול יכול לייצר המלצות' });
      return;
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      res.status(404).json({ error: 'טיול לא נמצא' });
      return;
    }

    if (trip.status !== 'PLANNING' && trip.status !== 'VOTING') {
      res.status(400).json({ error: 'ניתן לייצר המלצות רק בשלבי תכנון או הצבעה' });
      return;
    }

    const answers = await prisma.questionAnswer.findMany({
      where: { tripId },
      include: { question: { select: { text: true } } },
    });

    if (answers.length === 0) {
      res.status(400).json({ error: 'אין תשובות לשאלון עדיין' });
      return;
    }

    const memberMap = new Map<string, { question: string; answer: string }[]>();
    for (const a of answers) {
      if (!memberMap.has(a.userId)) memberMap.set(a.userId, []);
      memberMap.get(a.userId)!.push({
        question: a.question.text,
        answer: JSON.stringify(a.answer),
      });
    }

    const membersAnswers = Array.from(memberMap.values()).map((ans) => ({ answers: ans }));

    const suggestions = await generateDestinations(membersAnswers);

    // מחק votes לפני destinations (foreign key)
    const existing = await prisma.suggestedDestination.findMany({ where: { tripId }, select: { id: true } });
    const ids = existing.map(d => d.id);
    if (ids.length > 0) {
      await prisma.destinationVote.deleteMany({ where: { destinationId: { in: ids } } });
    }
    await prisma.suggestedDestination.deleteMany({ where: { tripId } });

    const saved = await prisma.$transaction(
      suggestions.map((s) =>
        prisma.suggestedDestination.create({
          data: {
            tripId,
            name: s.name,
            country: s.country,
            description: s.description,
            whyItFits: s.whyItFits,
            matchScore: s.matchScore,
            climate: s.climate,
            highlights: s.highlights,
          },
        })
      )
    );

    await prisma.trip.update({
      where: { id: tripId },
      data: { status: 'VOTING' },
    });

    const destinationsWithVotes = await prisma.suggestedDestination.findMany({
      where: { tripId },
      include: { votes: { select: { userId: true, score: true } } },
      orderBy: { matchScore: 'desc' },
    });

    res.json({ destinations: destinationsWithVotes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בייצור המלצות' });
  }
};

export const getDestinations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tripId = req.params['tripId'] as string;

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId } },
    });

    if (!member) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    const destinations = await prisma.suggestedDestination.findMany({
      where: { tripId },
      include: {
        votes: { select: { userId: true, score: true } },
      },
      orderBy: { matchScore: 'desc' },
    });

    res.json({ destinations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת היעדים' });
  }
};

export const vote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const destinationId = req.params['destinationId'] as string;
    const { score } = req.body;

    if (!score || score < 1 || score > 5) {
      res.status(400).json({ error: 'ציון חייב להיות בין 1 ל-5' });
      return;
    }

    const destination = await prisma.suggestedDestination.findUnique({
      where: { id: destinationId },
    });

    if (!destination) {
      res.status(404).json({ error: 'יעד לא נמצא' });
      return;
    }

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId: destination.tripId } },
    });

    if (!member) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    const voteRecord = await prisma.destinationVote.upsert({
      where: { destinationId_userId: { destinationId, userId: req.userId! } },
      update: { score },
      create: { destinationId, userId: req.userId!, score },
    });

    res.json({ vote: voteRecord });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהצבעה' });
  }
};

export const getResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tripId = req.params['tripId'] as string;

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId } },
    });

    if (!member) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    const destinations = await prisma.suggestedDestination.findMany({
      where: { tripId },
      include: {
        votes: { select: { score: true } },
      },
    });

    const results = destinations
      .map((d) => ({
        id: d.id,
        name: d.name,
        country: d.country,
        matchScore: d.matchScore,
        avgVote:
          d.votes.length > 0
            ? d.votes.reduce((sum: number, v: { score: number }) => sum + v.score, 0) / d.votes.length
            : null,
        totalVotes: d.votes.length,
      }))
      .sort((a, b) => (b.avgVote ?? 0) - (a.avgVote ?? 0));

    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת תוצאות' });
  }
};
