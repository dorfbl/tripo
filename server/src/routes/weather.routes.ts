import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getTripWeather } from '../controllers/weather.controller';

const router = Router();
router.get('/:tripId', authenticateToken, getTripWeather);
export default router;
