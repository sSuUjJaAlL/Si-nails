import { Router } from 'express';
import * as ctrl from '../controllers/serviceController.js';
import { adminMiddleware, authMiddleware } from '../middleware/auth.js';

const router = Router();

/** Kept for appointment find-or-create internals; no Admin Services UI. */
router.use(authMiddleware, adminMiddleware);
router.get('/', ctrl.listServices);
router.post('/', ctrl.createService);
router.put('/:id', ctrl.updateService);
router.delete('/:id', ctrl.deleteService);

export default router;
