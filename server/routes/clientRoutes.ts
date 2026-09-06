import { Router } from 'express';
import * as ctrl from '../controllers/clientController.js';
import { adminMiddleware, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware, adminMiddleware);
router.get('/', ctrl.listClients);
router.post('/', ctrl.createClient);
router.get('/:id', ctrl.getClient);
router.put('/:id', ctrl.updateClient);
router.delete('/:id', ctrl.deleteClient);

export default router;
