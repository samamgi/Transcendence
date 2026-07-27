import { Router } from "express";
import { tournamentController } from "../controllers/tournament.controller.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";

const router = Router();

router.get(
	"/active",
	requireAuth,
	asyncHandler(
		tournamentController.getActive.bind(
			tournamentController,
		),
	),
);

router.get(
	"/:id",
	requireAuth,
	asyncHandler(
		tournamentController.getById.bind(
			tournamentController,
		),
	),
);

router.post(
	"/",
	requireAuth,
	asyncHandler(
		tournamentController.create.bind(
			tournamentController,
		),
	),
);

router.post(
	"/:id/join",
	requireAuth,
	asyncHandler(
		tournamentController.join.bind(
			tournamentController,
		),
	),
);

router.post(
	"/:id/start",
	requireAuth,
	asyncHandler(
		tournamentController.start.bind(
			tournamentController,
		),
	),
);

router.post(
	"/:id/matches/:matchId/report",
	requireAuth,
	asyncHandler(
		tournamentController.reportResult.bind(
			tournamentController,
		),
	),
);

export default router;
