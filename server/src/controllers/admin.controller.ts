import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const ADMIN_EMAIL = 'dorfbl@gmail.com';

async function requireAdmin(req: AuthRequest, res: Response): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user || user.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: 'גישה מורשית למנהלים בלבד' });
    return false;
  }
  return true;
}

export const getAllQuestions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!await requireAdmin(req, res)) return;
    const questions = await prisma.question.findMany({ orderBy: { order: 'asc' } });
    res.json({ questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת שאלות' });
  }
};

export const createQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!await requireAdmin(req, res)) return;
    const { text, category, type, order, options, isActive } = req.body;

    if (!text?.trim()) { res.status(400).json({ error: 'טקסט השאלה חובה' }); return; }
    if (!category?.trim()) { res.status(400).json({ error: 'קטגוריה חובה' }); return; }
    if (!type) { res.status(400).json({ error: 'סוג שאלה חובה' }); return; }
    if (order == null) { res.status(400).json({ error: 'מספר סדר חובה' }); return; }

    const existing = await prisma.question.findUnique({ where: { text: text.trim() } });
    if (existing) { res.status(400).json({ error: 'שאלה עם טקסט זה כבר קיימת' }); return; }

    const question = await prisma.question.create({
      data: {
        text: text.trim(),
        category: category.trim(),
        type,
        order: Number(order),
        options: options ?? undefined,
        isActive: isActive ?? true,
      },
    });
    res.json({ question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה ביצירת שאלה' });
  }
};

export const updateQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!await requireAdmin(req, res)) return;
    const id = req.params['id'] as string;
    const { text, category, type, order, options, isActive } = req.body;

    if (!text?.trim()) { res.status(400).json({ error: 'טקסט השאלה חובה' }); return; }

    // בדיקה שהטקסט החדש לא קיים אצל שאלה אחרת
    const existing = await prisma.question.findUnique({ where: { text: text.trim() } });
    if (existing && existing.id !== id) {
      res.status(400).json({ error: 'שאלה עם טקסט זה כבר קיימת' }); return;
    }

    const question = await prisma.question.update({
      where: { id },
      data: {
        text: text.trim(),
        category: category?.trim(),
        type,
        order: order != null ? Number(order) : undefined,
        options: options !== undefined ? options : undefined,
        isActive: isActive ?? undefined,
      },
    });
    res.json({ question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון שאלה' });
  }
};

export const deleteQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!await requireAdmin(req, res)) return;
    const id = req.params['id'] as string;

    const answersCount = await prisma.questionAnswer.count({ where: { questionId: id } });
    if (answersCount > 0) {
      // יש תשובות — השבת בלבד
      await prisma.question.update({ where: { id }, data: { isActive: false } });
      res.json({ deleted: false, deactivated: true, message: 'השאלה הושבתה (קיימות תשובות קשורות)' });
    } else {
      await prisma.question.delete({ where: { id } });
      res.json({ deleted: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה במחיקת שאלה' });
  }
};

export const toggleQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!await requireAdmin(req, res)) return;
    const id = req.params['id'] as string;
    const question = await prisma.question.findUnique({ where: { id } });
    if (!question) { res.status(404).json({ error: 'שאלה לא נמצאה' }); return; }
    const updated = await prisma.question.update({
      where: { id },
      data: { isActive: !question.isActive },
    });
    res.json({ question: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בשינוי סטטוס שאלה' });
  }
};
