import type {
	Request,
	Response,
} from "express";
import { matchService } from "../services/match.service.js";

export class MatchController {
	async getMyHistory(
		request: Request,
		response: Response,
	) {
		const history =
			await matchService.getUserHistory(
				request.session.userId!,
			);

		response.status(200).json(history);
	}
}

export const matchController =
	new MatchController();
