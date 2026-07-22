import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";
import { asyncHandler } from "../lib/async-handler.js";

const router = Router();

router.post(
	"/register",
	asyncHandler(authController.register.bind(authController)),
);

router.post(
	"/login",
	asyncHandler(authController.login.bind(authController)),
);

router.get(
	"/me",
	requireAuth,
	asyncHandler(authController.me.bind(authController)),
);

router.post(
	"/logout",
	requireAuth,
	asyncHandler(authController.logout.bind(authController)),
);

export default router;
