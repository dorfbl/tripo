import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getAssistantTips } from '../controllers/assistant.controller';

const router = Router();
router.get('/:tripId', authenticateToken, getAssistantTips);
export default router;
