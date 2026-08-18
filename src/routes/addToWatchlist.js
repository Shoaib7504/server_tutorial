import express from "express";
import { addToWatchlist, updateWatchlistItem, removeFromWatchlist } from "../controller/watchlistController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { AddToWatchlistSchema } from "../Validators/watchlistValidators.js";
const router = express.Router();
router.use(authMiddleware)

router.post('/',validateRequest(AddToWatchlistSchema), addToWatchlist);
router.patch('/:id',validateRequest(AddToWatchlistSchema),updateWatchlistItem);
router.delete('/:id',removeFromWatchlist);

export default router