import { Router } from 'express';
import multer from 'multer';
import { fetchChatMessages, uploadVoiceNote } from '../controllers/chatController.js';
import { jwtMiddleware } from '../middlewares/authMiddleware.js';
import { standardApiLimiter, mediaUploadLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // Max 5MB per API Spec
  },
});

router.get('/messages', standardApiLimiter, jwtMiddleware, fetchChatMessages);

// Resolution 4: Dedicated POST /api/v1/chat/upload-audio (plus /audio alias)
router.post(
  '/upload-audio',
  mediaUploadLimiter,
  jwtMiddleware,
  audioUpload.single('audioFile'),
  uploadVoiceNote
);
router.post(
  '/audio',
  mediaUploadLimiter,
  jwtMiddleware,
  audioUpload.single('audioFile'),
  uploadVoiceNote
);

export default router;
