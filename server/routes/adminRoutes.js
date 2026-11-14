import { Router } from 'express';
import {
  getActivityLogs,
  getTimelineStations,
  restoreStationsBulk,
  recordActivity,
} from '../services/dataStore.js';
import { adminAuthMiddleware } from '../middlewares/authMiddleware.js';
import { standardApiLimiter } from '../middlewares/rateLimiter.js';
import { sendSuccess, sendError } from '../middlewares/errorHandler.js';

const router = Router();

/**
 * Resolution 3: GET /api/v1/admin/logs?limit=50
 */
router.get('/logs', standardApiLimiter, adminAuthMiddleware, async (req, res, next) => {
  try {
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = !Number.isNaN(rawLimit) && rawLimit > 0 && rawLimit <= 200 ? rawLimit : 50;
    const logs = await getActivityLogs(limit);
    return sendSuccess(res, logs);
  } catch (err) {
    next(err);
  }
});

/**
 * Resolution 3: GET /api/v1/admin/backup
 * Downloads `memory_stations` collection as `chronos_backup.json`
 */
router.get('/backup', standardApiLimiter, adminAuthMiddleware, async (_req, res, next) => {
  try {
    const stations = await getTimelineStations();
    return sendSuccess(res, {
      filename: 'chronos_backup.json',
      exportedAt: new Date().toISOString(),
      version: '3.0.0',
      stations,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Resolution 3: POST /api/v1/admin/restore
 * Accepts JSON payload, drops current stations, and bulk inserts.
 */
router.post('/restore', standardApiLimiter, adminAuthMiddleware, async (req, res, next) => {
  try {
    const stationsArray = Array.isArray(req.body) ? req.body : req.body?.stations;
    if (!Array.isArray(stationsArray)) {
      return sendError(
        res,
        400,
        'INVALID_BACKUP_FORMAT',
        'Expected an array of stations in request body.'
      );
    }

    const restored = await restoreStationsBulk(stationsArray);
    await recordActivity('ADMIN', `Restored ${restored.length} stations from chronos_backup.json`);

    const io = req.app.get('io');
    if (io) {
      io.to('chronos_vault').emit('timeline:updated', { restored: true });
    }

    return sendSuccess(res, {
      message: `Successfully restored ${restored.length} stations.`,
      stations: restored,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

