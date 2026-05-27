import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getAllQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  toggleQuestion,
} from '../controllers/admin.controller';

const router = Router();

router.use(authMiddleware);

router.get('/questions', getAllQuestions);
router.post('/questions', createQuestion);
router.put('/questions/:id', updateQuestion);
router.delete('/questions/:id', deleteQuestion);
router.patch('/questions/:id/toggle', toggleQuestion);

export default router;
