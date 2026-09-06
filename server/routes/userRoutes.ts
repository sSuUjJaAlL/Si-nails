import { Router } from 'express';
import * as ctrl from '../controllers/userController.js';
import { adminMiddleware, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware, adminMiddleware);
router.get('/', ctrl.listUsers);
router.post('/', ctrl.createUser);
router.put('/:id', ctrl.updateUser);
router.delete('/:id', ctrl.deleteUser);

export default router;
