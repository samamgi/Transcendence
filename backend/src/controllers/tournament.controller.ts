import type { Request, Response } from "express";
import { tournamentService } from "../services/tournament.service.js";

export class TournamentController {
	async create(
		request: Request,
		response: Response,
	) {
		const tournament = await tournamentService.createTournament(
			String(request.body?.name ?? ""),
			request.session.userId!,
		);

		response.status(201).json({
			tournament,
		});
	}

	async getActive(
		_request: Request,
		response: Response,
	) {
		const tournament =
			tournamentService.getActiveTournament();

		response.status(200).json({
			tournament,
		});
	}

	async getById(
		request: Request,
		response: Response,
	) {
		const tournament = tournamentService.getTournament(
			String(request.params.id),
		);

		response.status(200).json({
			tournament,
		});
	}

	async join(
		request: Request,
		response: Response,
	) {
		const tournament = await tournamentService.joinTournament(
			String(request.params.id),
			request.session.userId!,
		);

		response.status(200).json({
			tournament,
		});
	}

	async start(
		request: Request,
		response: Response,
	) {
		const tournament = tournamentService.startTournament(
			String(request.params.id),
			request.session.userId!,
		);

		response.status(200).json({
			tournament,
		});
	}

	async reportResult(
		request: Request,
		response: Response,
	) {
		const tournament = tournamentService.reportMatchResult(
			String(request.params.id),
			String(request.params.matchId),
			request.session.userId!,
			{
				winnerId: Number(request.body?.winnerId),
				player1Score: Number(request.body?.player1Score),
				player2Score: Number(request.body?.player2Score),
			},
		);

		response.status(200).json({
			tournament,
		});
	}
}

export const tournamentController =
	new TournamentController();
