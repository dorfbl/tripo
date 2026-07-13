import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getMySubscription,
  setMyPlan,
  adminListUsers,
  adminSetUserPlan,
  adminGetPlanConfigs,
  adminUpdatePlanConfig,
} from '../controllers/subscription.controller';

const router = Router();

router.get('/me', authenticateToken, getMySubscription);
router.post('/me/plan', authenticateToken, setMyPlan);

// Super admin
router.get('/admin/users', authenticateToken, adminListUsers);
router.patch('/admin/users/:userId', authenticateToken, adminSetUserPlan);
router.get('/admin/plans', authenticateToken, adminGetPlanConfigs);
router.put('/admin/plans/:planId', authenticateToken, adminUpdatePlanConfig);

export default router;
