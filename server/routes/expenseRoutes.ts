import { Router } from 'express';
import * as ctrl from '../controllers/expenseController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/users', ctrl.listExpenseUsers);
router.get('/', ctrl.listExpenses);
router.post('/', ctrl.createExpense);
router.put('/:id', ctrl.updateExpense);
router.delete('/:id', ctrl.deleteExpense);

export default router;
