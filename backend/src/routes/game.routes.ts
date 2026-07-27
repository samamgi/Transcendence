import { Router } from "express";
import { gameController } from "../controllers/game.controller.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";

const router = Router();

router.get(
	"/me",
	requireAuth,
	asyncHandler(
		gameController.getMyStatistics.bind(
			gameController,
		),
	),
);

export default router;
