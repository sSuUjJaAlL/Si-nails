import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as auth from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many setup attempts. Please try again later.' },
});

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many signup attempts. Please try again later.' },
});

router.get('/setup-status', auth.setupStatus);
router.post('/setup', setupLimiter, auth.setup);
router.post('/signup', signupLimiter, auth.signup);
router.post('/login', loginLimiter, auth.login);
router.get('/me', authMiddleware, auth.me);
router.put('/profile', authMiddleware, auth.updateProfile);
router.post('/logout', auth.logout);

export default router;
