import type { Request, Response } from "express";
import { gameService } from "../services/game.service.js";

export class GameController {
	async getMyStatistics(
		request: Request,
		response: Response,
	) {
		const result =
			await gameService.getUserStatistics(
				request.session.userId!,
			);

		response.status(200).json(result);
	}
}

export const gameController =
	new GameController();
