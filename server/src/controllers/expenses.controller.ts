import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

// ─── קטגוריות ─────────────────────────────────────────────────────────────────
const VALID_CATEGORIES = ['food', 'accommodation', 'transport', 'activities', 'shopping', 'health', 'other'];

// ─── אלגוריתם מינימום עסקאות ──────────────────────────────────────────────────
interface BalanceEntry { userId: string; name: string; net: number }
interface Settlement   { from: { userId: string; name: string }; to: { userId: string; name: string }; amountILS: number }

function calcSettlements(
  expenses: { amountILS: number; paidByUserId: string; participants: { userId: string }[] }[],
  members:  { userId: string; user: { name: string } }[],
): Settlement[] {
  const bal = new Map<string, BalanceEntry>();
  for (const m of members) bal.set(m.userId, { userId: m.userId, name: m.user.name, net: 0 });

  for (const exp of expenses) {
    const parts = exp.participants.map(p => p.userId);
    if (!parts.length) continue;
    const share = exp.amountILS / parts.length;

    const payer = bal.get(exp.paidByUserId);
    if (payer) payer.net += exp.amountILS;

    for (const pid of parts) {
      const p = bal.get(pid);
      if (p) p.net -= share;
    }
  }

  // מינימום עסקאות — greedy
  const debtors  = [...bal.values()].filter(b => b.net < -0.01).sort((a, b) => a.net - b.net);
  const creditors = [...bal.values()].filter(b => b.net >  0.01).sort((a, b) => b.net - a.net);
  const settlements: Settlement[] = [];

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor   = debtors[i];
    const creditor = creditors[j];
    const amount   = Math.min(-debtor.net, creditor.net);

    if (amount > 0.01) {
      settlements.push({
        from:      { userId: debtor.userId,   name: debtor.name   },
        to:        { userId: creditor.userId,  name: creditor.name },
        amountILS: Math.round(amount * 100) / 100,
      });
    }
    debtor.net   += amount;
    creditor.net -= amount;
    if (Math.abs(debtor.net)   < 0.01) i++;
    if (Math.abs(creditor.net) < 0.01) j++;
  }
  return settlements;
}

// ─── GET /api/expenses/:tripId ─────────────────────────────────────────────────
export const getExpenses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    const [expenses, members] = await Promise.all([
      prisma.tripExpense.findMany({
        where: { tripId },
        include: {
          paidBy:       { select: { id: true, name: true } },
          participants: { include: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tripMember.findMany({
        where: { tripId },
        include: { user: { select: { id: true, name: true } } },
      }),
    ]);

    const settlements = calcSettlements(expenses, members);
    const totalILS    = expenses.reduce((s, e) => s + e.amountILS, 0);

    res.json({ expenses, settlements, totalILS, members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת הוצאות' });
  }
};

// ─── POST /api/expenses/:tripId ───────────────────────────────────────────────
export const addExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    const { paidByUserId, amount, currency, exchangeRate, description, category, participantIds } = req.body;

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    // ולידציות
    if (!description?.trim())             { res.status(400).json({ error: 'תיאור הוצאה חסר' }); return; }
    if (!amount || amount <= 0)            { res.status(400).json({ error: 'סכום לא תקין' }); return; }
    if (!exchangeRate || exchangeRate <= 0){ res.status(400).json({ error: 'שער מרה לא תקין' }); return; }
    if (!paidByUserId)                     { res.status(400).json({ error: 'חסר מי שילם' }); return; }
    if (!participantIds?.length)           { res.status(400).json({ error: 'חסרים משתתפים' }); return; }

    // וודא שמי שילם הוא חבר בטיול
    const payer = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: paidByUserId, tripId } },
    });
    if (!payer) { res.status(400).json({ error: 'מי ששילם אינו חבר בטיול' }); return; }

    const amountILS = Math.round(amount * exchangeRate * 100) / 100;

    const expense = await prisma.tripExpense.create({
      data: {
        tripId,
        paidByUserId,
        amount,
        currency: currency || 'ILS',
        exchangeRate,
        amountILS,
        description: description.trim(),
        category: VALID_CATEGORIES.includes(category) ? category : 'other',
        participants: {
          create: (participantIds as string[]).map(uid => ({ userId: uid })),
        },
      },
      include: {
        paidBy:       { select: { id: true, name: true } },
        participants: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    res.status(201).json({ expense });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהוספת הוצאה' });
  }
};

// ─── DELETE /api/expenses/:expenseId ─────────────────────────────────────────
export const deleteExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { expenseId } = req.params as { expenseId: string };

    const expense = await prisma.tripExpense.findUnique({ where: { id: expenseId } });
    if (!expense) { res.status(404).json({ error: 'הוצאה לא נמצאה' }); return; }

    // מותר למחוק: מי ששילם, או מנהל הטיול
    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId: expense.tripId } },
    });
    if (!member) { res.status(403).json({ error: 'אינך חבר בטיול זה' }); return; }

    const canDelete = expense.paidByUserId === req.userId || member.role === 'ADMIN';
    if (!canDelete) { res.status(403).json({ error: 'רק מי ששילם או מנהל יכולים למחוק הוצאה' }); return; }

    await prisma.tripExpense.delete({ where: { id: expenseId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה במחיקת הוצאה' });
  }
};
