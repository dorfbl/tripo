import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getDecisions,
  createDecision,
  closeDecision,
  reopenDecision,
  deleteDecision,
  castVote,
  addOption,
} from '../controllers/decisions.controller';

const router = Router();

router.get('/:tripId',                  authenticateToken, getDecisions);
router.post('/:tripId',                 authenticateToken, createDecision);
router.put('/:decisionId/close',        authenticateToken, closeDecision);
router.put('/:decisionId/reopen',       authenticateToken, reopenDecision);
router.delete('/:decisionId',           authenticateToken, deleteDecision);
router.post('/:decisionId/vote',        authenticateToken, castVote);
router.post('/:decisionId/options',     authenticateToken, addOption);

export default router;
