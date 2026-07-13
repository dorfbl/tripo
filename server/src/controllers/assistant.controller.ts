import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { buildAssistantTips } from '../services/assistant.service';

export const getAssistantTips = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId } },
    });
    if (!member) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    const tips = await buildAssistantTips(tripId);
    res.json({ tips, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[assistant]', err);
    res.status(500).json({ error: 'שגיאה ביצירת טיפים' });
  }
};
