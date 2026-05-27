import { Router } from 'express';
import { getQuestions, saveAnswers, getStatus } from '../controllers/questionnaire.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/questions', getQuestions);
router.post('/:tripId/answers', saveAnswers);
router.get('/:tripId/status', getStatus);

export default router;
