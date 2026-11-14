import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  getAppConfig,
  saveAppConfig,
  getActivityLogs,
  recordActivity,
  getSystemHealth,
} from '../services/dataStore.js';
import { sendSuccess, sendError } from '../middlewares/errorHandler.js';

const updatePasswordsSchema = z.object({
  newSecretWord: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-zA-Z0-9 ]+$/, 'Secret word must be alphanumeric and spaces only')
    .optional()
    .or(z.literal('')),
  newHerPin: z
    .string()
    .regex(/^\d{6}$/, 'Her PIN must be 6 digits')
    .optional()
    .or(z.literal('')),
  newHisPin: z
    .string()
    .regex(/^\d{6}$/, 'His PIN must be 6 digits')
    .optional()
    .or(z.literal('')),
});

/**
 * PUT /api/v1/config/passwords
 * Updates the dynamic AppConfig (Secret Word, PINs) and syncs to Redis.
 */
export const updatePasswords = async (req, res, next) => {
  try {
    const parsed = updatePasswordsSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        parsed.error.errors.map((e) => e.message).join(', ')
      );
    }

    const { newSecretWord, newHerPin, newHisPin } = parsed.data;
    const current = await getAppConfig();
    if (!current) {
      return sendError(res, 403, 'SYSTEM_UNINITIALIZED', 'Run Genesis Setup first.');
    }

    const herPinHash = newHerPin ? await bcrypt.hash(newHerPin, 10) : current.herPin;
    const hisPinHash = newHisPin ? await bcrypt.hash(newHisPin, 10) : current.hisPin;
    const secretWord = newSecretWord ? newSecretWord.trim().toLowerCase() : current.secretWord;

    await saveAppConfig({
      masterPasswordHash: current.masterPassword,
      secretWord,
      herPinHash,
      hisPinHash,
    });

    await recordActivity('ADMIN', `Updated dynamic Vault credentials (Secret Word: "${secretWord}")`);

    return sendSuccess(res, {
      message: 'Vault credentials updated and synced to Redis.',
      secretWord,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/config/overview
 * Returns current secretWord, system health, and ActivityLog watcher entries for Admin panel.
 */
export const getAdminOverview = async (_req, res, next) => {
  try {
    const [config, logs] = await Promise.all([getAppConfig(), getActivityLogs(60)]);
    const health = getSystemHealth();

    return sendSuccess(res, {
      secretWord: config?.secretWord || '',
      updatedAt: config?.updatedAt || null,
      health,
      logs,
    });
  } catch (err) {
    next(err);
  }
};

