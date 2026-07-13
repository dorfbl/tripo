import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  listFlights,
  createFlight,
  refreshFlight,
  deleteFlight,
} from '../controllers/flights.controller';

const router = Router();
// Specific paths first (avoid clashing with :tripId)
router.post('/item/:flightId/refresh', authenticateToken, refreshFlight);
router.delete('/item/:flightId', authenticateToken, deleteFlight);
router.get('/:tripId', authenticateToken, listFlights);
router.post('/:tripId', authenticateToken, createFlight);
export default router;
