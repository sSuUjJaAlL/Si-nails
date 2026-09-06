import { Router } from 'express';
import * as ctrl from '../controllers/reportController.js';
import { adminMiddleware, authMiddleware, userMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/summary', authMiddleware, adminMiddleware, ctrl.getSummary);
router.get('/business', authMiddleware, adminMiddleware, ctrl.getBusinessReport);
router.get('/activity', authMiddleware, adminMiddleware, ctrl.getActivity);
router.get('/entry-clients', authMiddleware, adminMiddleware, ctrl.getEntryClients);
router.get('/user-dashboard', authMiddleware, userMiddleware, ctrl.getUserDashboard);

export default router;
