import { Router } from "express";
import { blockController } from "../controllers/block.controller.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";

const router = Router();

router.get(
	"/",
	requireAuth,
	asyncHandler(
		blockController.getBlockedUsers.bind(blockController),
	),
);

router.post(
	"/:userId",
	requireAuth,
	asyncHandler(
		blockController.blockUser.bind(blockController),
	),
);

router.delete(
	"/:userId",
	requireAuth,
	asyncHandler(
		blockController.unblockUser.bind(blockController),
	),
);

export default router;
