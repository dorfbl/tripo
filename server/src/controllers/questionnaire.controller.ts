import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { InputJsonValue } from '@prisma/client/runtime/library';

export const getQuestions = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const questions = await prisma.question.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
    res.json({ questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת השאלות' });
  }
};

export const saveAnswers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tripId = req.params['tripId'] as string;
    const { answers } = req.body; // [{ questionId, answer }]

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({ error: 'יש לספק תשובות' });
      return;
    }

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId } },
    });

    if (!member) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    await prisma.$transaction(
      answers.map((a: { questionId: string; answer: InputJsonValue }) =>
        prisma.questionAnswer.upsert({
          where: {
            userId_tripId_questionId: {
              userId: req.userId!,
              tripId,
              questionId: a.questionId,
            },
          },
          update: { answer: a.answer as InputJsonValue },
          create: {
            userId: req.userId!,
            tripId,
            questionId: a.questionId,
            answer: a.answer as InputJsonValue,
          },
        })
      )
    );

    await prisma.tripMember.update({
      where: { userId_tripId: { userId: req.userId!, tripId } },
      data: { completedQuestionnaire: true },
    });

    res.json({ message: 'התשובות נשמרו בהצלחה' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בשמירת התשובות' });
  }
};

export const getStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tripId = req.params['tripId'] as string;

    const members = await prisma.tripMember.findMany({
      where: { tripId },
      include: { user: { select: { id: true, name: true } } },
    });

    const isMember = members.some((m) => m.userId === req.userId);
    if (!isMember) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    const total = members.length;
    const completed = members.filter((m) => m.completedQuestionnaire).length;

    res.json({
      total,
      completed,
      allCompleted: completed === total,
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        completed: m.completedQuestionnaire,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בבדיקת סטטוס השאלון' });
  }
};
