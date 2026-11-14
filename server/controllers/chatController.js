import { getRecentMessages, addChatMessage, recordActivity } from '../services/dataStore.js';
import { uploadMediaBuffer } from '../services/cloudinaryService.js';
import { sendSuccess, sendError } from '../middlewares/errorHandler.js';

/**
 * GET /api/v1/chat/messages
 * Retrieves chat messages from the last 24 hours.
 */
export const fetchChatMessages = async (req, res, next) => {
  try {
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = !Number.isNaN(rawLimit) && rawLimit > 0 && rawLimit <= 200 ? rawLimit : 50;
    const messages = await getRecentMessages(limit);
    return sendSuccess(res, messages);
  } catch (err) {
    next(err);
  }
};

/**
 * Resolution 4 & 8: POST /api/v1/chat/upload-audio (and /audio alias)
 * - Uploads voice note to `chronos/ephemeral_chat/`
 * - Enforces .m4a (AAC) or .mp3, or forces Cloudinary `f_m4a` transcode for iOS Safari native decoding
 * - Stores `cloudinaryPublicId` on ChatMessage
 */
export const uploadVoiceNote = async (req, res, next) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'AUDIO_REQUIRED', 'No audio file uploaded.');
    }

    const uploaded = await uploadMediaBuffer(req.file, {
      folder: 'chronos/ephemeral_chat',
      forceAudioM4a: true,
    });
    const senderRole = req.user?.role || 'PARTNER_HER';

    const savedMsg = await addChatMessage({
      senderRole,
      type: 'audio',
      content: uploaded.url,
      cloudinaryPublicId: uploaded.publicId,
    });

    await recordActivity(senderRole, 'Sent 24h ephemeral voice note (chronos/ephemeral_chat)');

    const io = req.app.get('io');
    if (io) {
      io.to('chronos_vault').emit('chat:receive', savedMsg);
    }

    return sendSuccess(res, savedMsg, 201);
  } catch (err) {
    next(err);
  }
};
