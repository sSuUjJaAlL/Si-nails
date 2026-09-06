import { Router } from 'express';
import * as ctrl from '../controllers/paymentController.js';
import { adminMiddleware, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware, adminMiddleware);
router.get('/', ctrl.listPayments);

export default router;
