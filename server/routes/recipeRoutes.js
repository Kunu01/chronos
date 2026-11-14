import { Router } from 'express';
import { searchRecipes } from '../controllers/recipeController.js';
import { standardApiLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.get('/', standardApiLimiter, searchRecipes);

export default router;

