import { HttpError } from "../lib/http-error.js";
import { gameRepository } from "../repositories/game.repository.js";

type RecordGameData = {
	mode: "AI" | "ONLINE";
	status: "FINISHED" | "FORFEIT";
	player1Id: number;
	player2Id?: number;
	winnerId?: number;
	player1Score: number;
	player2Score: number;
	startedAt?: Date;
};

export class GameService {
	async recordMatch(data: RecordGameData) {
		if (
			!Number.isInteger(data.player1Id) ||
			data.player1Id <= 0
		) {
			throw new HttpError(
				400,
				"Invalid player 1 id",
			);
		}

		if (
			data.player2Id !== undefined &&
			(
				!Number.isInteger(data.player2Id) ||
				data.player2Id <= 0
			)
		) {
			throw new HttpError(
				400,
				"Invalid player 2 id",
			);
		}

		if (
			data.winnerId !== undefined &&
			data.winnerId !== data.player1Id &&
			data.winnerId !== data.player2Id
		) {
			throw new HttpError(
				400,
				"Winner must be a match participant",
			);
		}

		if (
			!Number.isInteger(data.player1Score) ||
			data.player1Score < 0 ||
			!Number.isInteger(data.player2Score) ||
			data.player2Score < 0
		) {
			throw new HttpError(
				400,
				"Invalid match score",
			);
		}

		return gameRepository.createMatch(data);
	}

	async getUserStatistics(userId: number) {
		if (
			!Number.isInteger(userId) ||
			userId <= 0
		) {
			throw new HttpError(
				400,
				"Invalid user id",
			);
		}

		const [totals, matches] =
			await Promise.all([
				gameRepository.getUserMatchTotals(
					userId,
				),
				gameRepository.getUserMatches(
					userId,
				),
			]);

		const losses =
			totals.total - totals.wins;

		const winRate =
			totals.total === 0
				? 0
				: Math.round(
						(totals.wins /
							totals.total) *
							100,
					);

		return {
			statistics: {
				totalMatches: totals.total,
				wins: totals.wins,
				losses,
				forfeits: totals.forfeits,
				winRate,
			},
			matches,
		};
	}
}

export const gameService =
	new GameService();
