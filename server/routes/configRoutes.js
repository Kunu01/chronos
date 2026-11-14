import { Router } from 'express';
import { updatePasswords, getAdminOverview } from '../controllers/configController.js';
import { adminAuthMiddleware } from '../middlewares/authMiddleware.js';
import { standardApiLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.put('/passwords', standardApiLimiter, adminAuthMiddleware, updatePasswords);
router.get('/overview', standardApiLimiter, adminAuthMiddleware, getAdminOverview);

export default router;

