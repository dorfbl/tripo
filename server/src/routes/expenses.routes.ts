import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getExpenses, addExpense, updateExpense, deleteExpense } from '../controllers/expenses.controller';

const router = Router();

router.get('/:tripId',           authenticateToken, getExpenses);
router.post('/:tripId',          authenticateToken, addExpense);
router.put('/:expenseId',        authenticateToken, updateExpense);
router.delete('/:expenseId',     authenticateToken, deleteExpense);

export default router;
