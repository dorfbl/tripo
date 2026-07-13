import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  listNotifications,
  markRead,
  markAllRead,
  generateSmart,
  deleteSmartNotifications,
} from '../controllers/notifications.controller';

const router = Router();

router.get('/', authenticateToken, listNotifications);
router.post('/read-all', authenticateToken, markAllRead);
router.post('/smart/:tripId', authenticateToken, generateSmart);
router.delete('/smart/:tripId', authenticateToken, deleteSmartNotifications);
router.post('/:id/read', authenticateToken, markRead);

export default router;
