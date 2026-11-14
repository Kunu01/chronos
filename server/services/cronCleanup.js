import cron from 'node-cron';
import { purgeExpiredEphemeralAudio } from './cloudinaryService.js';

/**
 * Resolution 4: Hourly node-cron job (`0 * * * *`)
 * Queries Cloudinary `chronos/ephemeral_chat/` folder and deletes voice note assets older than 24 hours.
 */
export const startEphemeralCleanupCron = () => {
  cron.schedule('0 * * * *', async () => {
    const { deleted } = await purgeExpiredEphemeralAudio();
    if (deleted > 0) {
      console.log(`[CHRONOS CRON] Purged ${deleted} expired (>24h) voice notes from Cloudinary`);
    }
  });
  console.log('[CHRONOS] Hourly 24h Ephemeral Audio Cleanup Cron scheduled (0 * * * *)');
};

