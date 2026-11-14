import { Router } from 'express';
import {
  checkSecretWord,
  verifyVaultCredentials,
  getAdminStatus,
  initializeGenesis,
  adminLogin,
  adminLogout,
  triggerGenesisReset,
} from '../controllers/authController.js';
import { authRateLimiter, standardApiLimiter } from '../middlewares/rateLimiter.js';
import { adminAuthMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/check-word', standardApiLimiter, checkSecretWord);
router.post('/verify', authRateLimiter, verifyVaultCredentials);

router.get('/admin/status', standardApiLimiter, getAdminStatus);
router.post('/admin/genesis', authRateLimiter, initializeGenesis);
router.post('/admin/login', authRateLimiter, adminLogin);
router.post('/admin/logout', standardApiLimiter, adminLogout);
router.post('/admin/reset-genesis', adminAuthMiddleware, triggerGenesisReset);

export default router;

