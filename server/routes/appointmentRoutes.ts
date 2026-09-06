import { Router } from 'express';
import * as ctrl from '../controllers/appointmentController.js';
import { adminMiddleware, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware, adminMiddleware);
router.get('/employees', ctrl.listAppointmentEmployees);
router.get('/', ctrl.listAppointments);
router.post('/', ctrl.createAppointment);
router.get('/:id', ctrl.getAppointment);
router.put('/:id', ctrl.updateAppointment);
router.patch('/:id/status', ctrl.updateAppointmentStatus);
router.delete('/:id', ctrl.deleteAppointment);

export default router;
