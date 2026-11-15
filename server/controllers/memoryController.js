import { z } from 'zod';
import {
  getTimelineStations,
  createMemoryStation,
  updateMemoryStation,
  appendStationAsset,
  deleteMemoryStation,
  recordActivity,
  getPlaylistTracks,
  addPlaylistTrack,
  deletePlaylistTrack,
} from '../services/dataStore.js';
import { uploadMediaBuffer } from '../services/cloudinaryService.js';
import { sendSuccess, sendError } from '../middlewares/errorHandler.js';

const createStationSchema = z.object({
  stationTitle: z.string().min(1).max(80),
  milestoneDate: z.string().min(1),
  environmentTheme: z
    .enum(['autumn-night', 'rainy-neon', 'sunset', 'midnight', 'stars'])
    .default('autumn-night'),
  secretLetter: z.string().max(2000).optional().default(''),
  caption: z.string().max(300).optional().default(''),
  displayType: z.enum(['billboard', 'coupe-table']).optional().default('billboard'),
  mediaUrl: z.string().optional(),
  mediaType: z.enum(['photo', 'audio', 'video']).optional().default('photo'),
  trackOrder: z.coerce.number().optional(),
});

/**
 * GET /api/v1/memories
 */
export const fetchMemories = async (_req, res, next) => {
  try {
    const stations = await getTimelineStations();
    return sendSuccess(res, stations);
  } catch (err) {
    next(err);
  }
};

/**
 * Resolution 3: POST /api/v1/memories/stations (and /station)
 * Can create an empty station OR a station with initial media asset.
 */
export const createStation = async (req, res, next) => {
  try {
    const parsed = createStationSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        parsed.error.errors.map((e) => e.message).join(', ')
      );
    }

    const {
      stationTitle,
      milestoneDate,
      environmentTheme,
      secretLetter,
      caption,
      displayType,
      mediaUrl,
      mediaType,
      trackOrder,
    } = parsed.data;

    let asset = null;
    if (req.file) {
      const uploaded = await uploadMediaBuffer(req.file, { folder: 'chronos/stations' });
      asset = {
        type: uploaded.type,
        url: uploaded.url,
        publicId: uploaded.publicId,
        caption: caption || stationTitle,
        displayType: displayType || 'billboard',
      };
    } else if (mediaUrl) {
      asset = {
        type: mediaType || 'photo',
        url: mediaUrl,
        caption: caption || stationTitle,
        displayType: displayType || 'billboard',
      };
    }

    const station = await createMemoryStation({
      stationTitle,
      milestoneDate,
      environmentTheme,
      secretLetter,
      asset,
      trackOrder,
    });

    await recordActivity('ADMIN', `Created 3D Train Station: "${stationTitle}"`);

    const io = req.app.get('io');
    if (io) {
      io.to('chronos_vault').emit('timeline:updated', { station });
    }

    return sendSuccess(
      res,
      {
        message: 'Station created and timeline cached.',
        station,
      },
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Resolution 3: PUT /api/v1/memories/stations/:id
 * Updates metadata or reorders `trackOrder`.
 */
export const updateStation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = {};
    if (typeof req.body.stationTitle === 'string') updates.stationTitle = req.body.stationTitle;
    if (req.body.milestoneDate) updates.milestoneDate = new Date(req.body.milestoneDate);
    if (typeof req.body.environmentTheme === 'string')
      updates.environmentTheme = req.body.environmentTheme;
    if (typeof req.body.secretLetter === 'string') updates.secretLetter = req.body.secretLetter;
    if (req.body.trackOrder !== undefined) updates.trackOrder = Number(req.body.trackOrder);

    const updated = await updateMemoryStation(id, updates);
    if (!updated) {
      return sendError(res, 404, 'NOT_FOUND', 'Station not found.');
    }

    await recordActivity('ADMIN', `Updated Station (${updated.stationTitle})`);

    const io = req.app.get('io');
    if (io) {
      io.to('chronos_vault').emit('timeline:updated', { station: updated });
    }

    return sendSuccess(res, {
      message: 'Station updated and Redis cache synced.',
      station: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Resolution 3: POST /api/v1/memories/stations/:id/assets
 * Pipes multipart/form-data stream via multer directly to Cloudinary and pushes into `MemoryStation.assets`.
 */
export const uploadStationAsset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const caption = String(req.body?.caption || '');
    const displayType = req.body?.displayType === 'coupe-table' ? 'coupe-table' : 'billboard';

    let asset = null;
    if (req.file) {
      const uploaded = await uploadMediaBuffer(req.file, { folder: 'chronos/stations' });
      asset = {
        type: uploaded.type,
        url: uploaded.url,
        publicId: uploaded.publicId,
        caption,
        displayType,
      };
    } else if (req.body?.mediaUrl) {
      asset = {
        type: req.body.mediaType || 'photo',
        url: req.body.mediaUrl,
        caption,
        displayType,
      };
    } else {
      return sendError(res, 400, 'MEDIA_REQUIRED', 'Please provide a mediaFile or mediaUrl.');
    }

    const updated = await appendStationAsset(id, asset);
    if (!updated) {
      return sendError(res, 404, 'NOT_FOUND', 'Station not found.');
    }

    await recordActivity('ADMIN', `Appended ${asset.type} asset to "${updated.stationTitle}"`);

    const io = req.app.get('io');
    if (io) {
      io.to('chronos_vault').emit('timeline:updated', { station: updated });
    }

    return sendSuccess(
      res,
      {
        message: 'Asset uploaded and appended to station.',
        station: updated,
      },
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Resolution 3: DELETE /api/v1/memories/stations/:id
 * Deletes station and triggers Cloudinary asset purge.
 */
export const removeStation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await deleteMemoryStation(id);
    await recordActivity('ADMIN', `Deleted 3D Train Station (${id}) & purged Cloudinary assets`);

    const io = req.app.get('io');
    if (io) {
      io.to('chronos_vault').emit('timeline:updated', { deletedId: id });
    }

    return sendSuccess(res, {
      message: 'Station deleted and Redis timeline cache refreshed.',
      stations: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const exportStationsBackup = async (_req, res, next) => {
  try {
    const stations = await getTimelineStations();
    return sendSuccess(res, {
      exportedAt: new Date().toISOString(),
      version: '3.0.0',
      count: stations.length,
      stations,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/memories/tracks
 * Returns background music playlist for the vault.
 */
export const fetchPlaylist = async (_req, res, next) => {
  try {
    const tracks = await getPlaylistTracks();
    return sendSuccess(res, tracks);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/memories/tracks
 * Uploads an audio track to Cloudinary or saves an audio streaming URL.
 */
export const uploadMusicTrack = async (req, res, next) => {
  try {
    const { title, artist, audioUrl } = req.body || {};
    if (!title) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Song title is required.');
    }

    let finalUrl = audioUrl;
    let publicId = null;

    if (req.file) {
      const uploaded = await uploadMediaBuffer(req.file, { folder: 'chronos/music' });
      finalUrl = uploaded.url;
      publicId = uploaded.publicId;
    }

    if (!finalUrl) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Audio file or audio URL is required.');
    }

    const track = await addPlaylistTrack({
      title,
      artist: artist || 'Ambient Soundscape',
      url: finalUrl,
      publicId,
    });

    const io = req.app.get('io');
    if (io) {
      io.to('chronos_vault').emit('music:updated', track);
    }

    return sendSuccess(res, track, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/memories/tracks/:id
 */
export const removeMusicTrack = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ok = await deletePlaylistTrack(id);
    if (!ok) {
      return sendError(res, 404, 'NOT_FOUND', 'Track not found.');
    }

    const io = req.app.get('io');
    if (io) {
      io.to('chronos_vault').emit('music:deleted', { id });
    }

    return sendSuccess(res, { message: 'Track removed from vault playlist.', id });
  } catch (err) {
    next(err);
  }
};
