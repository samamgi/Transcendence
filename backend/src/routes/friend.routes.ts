import { Router } from "express";
import { friendController } from "../controllers/friend.controller.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";

const router = Router();

router.get(
	"/",
	requireAuth,
	asyncHandler(
		friendController.getFriends.bind(friendController),
	),
);

router.get(
	"/requests",
	requireAuth,
	asyncHandler(
		friendController.getReceivedRequests.bind(friendController),
	),
);

router.post(
	"/requests/:requestId/decline",
	requireAuth,
	asyncHandler(
		friendController.declineRequest.bind(friendController),
	),
);

router.post(
	"/requests/:requestId/accept",
	requireAuth,
	asyncHandler(
		friendController.acceptRequest.bind(friendController),
	),
);

router.post(
	"/requests/:userId",
	requireAuth,
	asyncHandler(
		friendController.sendRequest.bind(friendController),
	),
);

router.delete(
	"/:userId",
	requireAuth,
	asyncHandler(
		friendController.deleteFriend.bind(friendController),
	),
);

export default router;
