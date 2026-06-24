import { Router } from 'express';
import {
  createTrip,
  getTrips,
  getTrip,
  joinTrip,
  getTripMembers,
  updateTrip,
  updateTripCurrency,
  removeMember,
  changeMemberRole,
} from '../controllers/trips.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.post('/', createTrip);
router.get('/', getTrips);
router.get('/:id', getTrip);
router.post('/join/:inviteCode', joinTrip);
router.get('/:id/members', getTripMembers);
router.put('/:id', updateTrip);
router.patch('/:id/currency', updateTripCurrency);
router.delete('/:id/members/:userId', removeMember);
router.patch('/:id/members/:userId/role', changeMemberRole);

export default router;
