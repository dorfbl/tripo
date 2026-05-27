import { Router } from 'express';
import {
  createTrip,
  getTrips,
  getTrip,
  joinTrip,
  getTripMembers,
} from '../controllers/trips.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.post('/', createTrip);
router.get('/', getTrips);
router.get('/:id', getTrip);
router.post('/join/:inviteCode', joinTrip);
router.get('/:id/members', getTripMembers);

export default router;
