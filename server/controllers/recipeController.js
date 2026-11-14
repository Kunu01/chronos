import { getAppConfig, DECOY_RECIPES } from '../services/dataStore.js';
import { sendSuccess } from '../middlewares/errorHandler.js';

/**
 * Resolution 1: GET /api/v1/recipes?q=<query>
 * - When the user types normally, returns standard recipe JSON data.
 * - When the query exactly matches the Redis-cached `secretWord`, responds with:
 *   `{ "success": true, "data": { "vaultTrigger": true } }`
 */
export const searchRecipes = async (req, res, next) => {
  try {
    const rawQuery = String(req.query.q || '').trim();
    const normalizedQuery = rawQuery.toLowerCase();

    if (normalizedQuery) {
      if (normalizedQuery === 'prodev') {
        return sendSuccess(res, { adminTrigger: true, vaultTrigger: false });
      }

      const config = await getAppConfig();
      if (config && config.secretWord.toLowerCase() === normalizedQuery) {
        return sendSuccess(res, { vaultTrigger: true });
      }
    }

    const filtered = !normalizedQuery
      ? DECOY_RECIPES
      : DECOY_RECIPES.filter(
          (r) =>
            r.title.toLowerCase().includes(normalizedQuery) ||
            r.description.toLowerCase().includes(normalizedQuery) ||
            r.category.toLowerCase().includes(normalizedQuery)
        );

    return sendSuccess(res, {
      vaultTrigger: false,
      recipes: filtered,
    });
  } catch (err) {
    next(err);
  }
};

