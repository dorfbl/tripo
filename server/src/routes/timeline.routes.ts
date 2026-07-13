import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getTimeline,
  createMemory,
  createAiRecap,
  deleteTimelineEvent,
} from '../controllers/timeline.controller';

const router = Router();

router.get('/:tripId', authenticateToken, getTimeline);
router.post('/:tripId', authenticateToken, createMemory);
router.post('/:tripId/ai-recap', authenticateToken, createAiRecap);
router.delete('/:eventId', authenticateToken, deleteTimelineEvent);

export default router;
