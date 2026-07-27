import { Router } from "express";
import { matchController } from "../controllers/match.controller.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";

const router = Router();

router.get(
	"/me",
	requireAuth,
	asyncHandler(
		matchController.getMyHistory.bind(
			matchController,
		),
	),
);

export default router;
