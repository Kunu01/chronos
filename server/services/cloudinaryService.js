import { v2 as cloudinary } from 'cloudinary';

export const isCloudinaryConfigured = () => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET &&
      !process.env.CLOUDINARY_CLOUD_NAME.includes('your_')
  );
};

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Resolution 4 & 8: Pipes a Multer memory buffer directly to Cloudinary.
 * - Photos: w_800,f_webp,q_auto
 * - Audio: Enforces .m4a (AAC) or .mp3; transcodes .wav/.ogg/.webm to f_m4a on upload for iOS Safari native decoding.
 * - Supports folder tagging (e.g. 'chronos/ephemeral_chat' or 'chronos/stations').
 */
export const uploadMediaBuffer = async (file, { folder = 'chronos/stations', forceAudioM4a = false } = {}) => {
  if (!file) {
    throw new Error('No media file provided');
  }

  const mime = (file.mimetype || 'image/jpeg').toLowerCase();
  let assetType = 'photo';
  if (mime.startsWith('audio/') || forceAudioM4a) assetType = 'audio';
  else if (mime.startsWith('video/')) assetType = 'video';

  if (isCloudinaryConfigured()) {
    return new Promise((resolve, reject) => {
      let uploadOptions = {
        folder,
        resource_type: assetType === 'photo' ? 'image' : 'video',
      };

      if (assetType === 'photo') {
        uploadOptions.transformation = [
          { width: 800, crop: 'limit', fetch_format: 'webp', quality: 'auto' },
        ];
      } else if (assetType === 'audio') {
        // Resolution 8.2: Force AAC (.m4a) transcode if not already .mp3 or .m4a
        const isNativeSafariAudio = mime.includes('mp3') || mime.includes('mpeg') || mime.includes('m4a') || mime.includes('mp4');
        if (!isNativeSafariAudio) {
          uploadOptions.format = 'm4a';
        }
      }

      const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) return reject(error);
        let optimizedUrl = result.secure_url;
        if (assetType === 'photo' && optimizedUrl.includes('/upload/') && !optimizedUrl.includes('w_800')) {
          optimizedUrl = optimizedUrl.replace('/upload/', '/upload/w_800,f_webp,q_auto/');
        }
        resolve({
          type: assetType,
          url: optimizedUrl,
          publicId: result.public_id || null,
        });
      });

      stream.end(file.buffer);
    });
  }

  // Fallback for zero-config local dev: inline data URI
  const base64 = file.buffer.toString('base64');
  return {
    type: assetType,
    url: `data:${mime};base64,${base64}`,
    publicId: `local_${folder.replace('/', '_')}_${Date.now()}`,
  };
};

/**
 * Deletes specific Cloudinary assets when a MemoryStation is deleted
 */
export const deleteCloudinaryAssets = async (assets = []) => {
  if (!isCloudinaryConfigured() || !Array.isArray(assets)) return;
  for (const asset of assets) {
    if (asset.publicId && !asset.publicId.startsWith('local_')) {
      try {
        const resourceType = asset.type === 'photo' ? 'image' : 'video';
        await cloudinary.uploader.destroy(asset.publicId, { resource_type: resourceType });
      } catch {
        // Ignore individual asset deletion failures
      }
    }
  }
};

/**
 * Resolution 4: Hourly Cloudinary Admin API cleanup of `chronos/ephemeral_chat/` assets older than 24 hours.
 */
export const purgeExpiredEphemeralAudio = async () => {
  if (!isCloudinaryConfigured()) return { deleted: 0 };

  try {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'video', // Cloudinary stores audio under 'video' resource_type
      prefix: 'chronos/ephemeral_chat/',
      max_results: 100,
    });

    const resources = result?.resources || [];
    const expiredIds = resources
      .filter((r) => new Date(r.created_at).getTime() < cutoffTime)
      .map((r) => r.public_id);

    if (expiredIds.length > 0) {
      await cloudinary.api.delete_resources(expiredIds, { resource_type: 'video' });
    }
    return { deleted: expiredIds.length };
  } catch (err) {
    console.warn('[CHRONOS CRON] Cloudinary ephemeral cleanup check skipped:', err.message);
    return { deleted: 0 };
  }
};
