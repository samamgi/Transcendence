import { Router } from "express";
import { avatarUpload } from "../config/multer.js";
import { userController } from "../controllers/user.controller.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";

const router = Router();

router.get(
	"/me",
	requireAuth,
	asyncHandler(userController.getMe.bind(userController)),
);

router.patch(
	"/me",
	requireAuth,
	asyncHandler(userController.updateMe.bind(userController)),
);

router.post(
	"/me/avatar",
	requireAuth,
	avatarUpload.single("avatar"),
	asyncHandler(userController.updateAvatar.bind(userController)),
);

router.get(
	"/search",
	requireAuth,
	asyncHandler(
		userController.searchUsers.bind(userController),
	),
);

router.get(
	"/:id",
	requireAuth,
	asyncHandler(userController.getById.bind(userController)),
);

export default router;
