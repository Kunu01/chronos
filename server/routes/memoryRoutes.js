import { Router } from 'express';
import multer from 'multer';
import {
  fetchMemories,
  createStation,
  updateStation,
  uploadStationAsset,
  removeStation,
  exportStationsBackup,
} from '../controllers/memoryController.js';
import { jwtMiddleware, adminAuthMiddleware } from '../middlewares/authMiddleware.js';
import { standardApiLimiter, mediaUploadLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

const vaultOrAdminAuth = (req, res, next) => {
  if (req.cookies?.admin_session || req.headers['x-admin-token']) {
    return adminAuthMiddleware(req, res, next);
  }
  return jwtMiddleware(req, res, next);
};

router.get('/', standardApiLimiter, vaultOrAdminAuth, fetchMemories);
router.get('/export', standardApiLimiter, adminAuthMiddleware, exportStationsBackup);

// Resolution 3 CRUD Endpoints (/stations and /station alias)
router.post(
  '/stations',
  mediaUploadLimiter,
  adminAuthMiddleware,
  upload.single('mediaFile'),
  createStation
);
router.post(
  '/station',
  mediaUploadLimiter,
  adminAuthMiddleware,
  upload.single('mediaFile'),
  createStation
);
router.put('/stations/:id', standardApiLimiter, adminAuthMiddleware, updateStation);
router.post(
  '/stations/:id/assets',
  mediaUploadLimiter,
  adminAuthMiddleware,
  upload.single('mediaFile'),
  uploadStationAsset
);
router.delete('/stations/:id', standardApiLimiter, adminAuthMiddleware, removeStation);
router.delete('/station/:id', standardApiLimiter, adminAuthMiddleware, removeStation);

export default router;
