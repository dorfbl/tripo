import { Router } from 'express';
import { generate, getDestinations, vote, getResults } from '../controllers/destinations.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.post('/:tripId/generate', generate);
router.get('/:tripId', getDestinations);
router.post('/:destinationId/vote', vote);
router.get('/:tripId/results', getResults);

export default router;
