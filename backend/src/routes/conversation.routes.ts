import { Router } from "express";

import { conversationController } from "../controllers/conversation.controller.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";

const router = Router();

router.get(
	"/",
	requireAuth,
	asyncHandler(
		conversationController.getUserConversations.bind(
			conversationController,
		),
	),
);

router.post(
	"/",
	requireAuth,
	asyncHandler(
		conversationController.createOrGetPrivateConversation.bind(
			conversationController,
		),
	),
);

router.delete(
	"/:conversationId",
	requireAuth,
	asyncHandler(
		conversationController.deleteConversation.bind(
			conversationController,
		),
	),
);

router.get(
	"/:conversationId/messages",
	requireAuth,
	asyncHandler(
		conversationController.getMessages.bind(
			conversationController,
		),
	),
);

router.post(
	"/:conversationId/messages",
	requireAuth,
	asyncHandler(
		conversationController.sendMessage.bind(
			conversationController,
		),
	),
);

export default router;
