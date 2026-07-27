import { HttpError } from "../lib/http-error.js";
import { matchRepository } from "../repositories/match.repository.js";

type CreateOnlineMatchData = {
	leftPlayerId: number;
	rightPlayerId: number;
	winnerId: number;
	leftScore: number;
	rightScore: number;
};

export class MatchService {
	async createOnlineMatch(
		data: CreateOnlineMatchData,
	) {
		if (
			data.leftPlayerId ===
			data.rightPlayerId
		) {
			throw new HttpError(
				400,
				"A player cannot play against themselves",
			);
		}

		if (
			data.winnerId !==
				data.leftPlayerId &&
			data.winnerId !==
				data.rightPlayerId
		) {
			throw new HttpError(
				400,
				"Invalid match winner",
			);
		}

		return matchRepository.createOnlineMatch(
			data,
		);
	}

	async getUserHistory(userId: number) {
		const matches =
			await matchRepository.findUserMatches(
				userId,
			);

		const wins = matches.filter(
			(match) => match.winnerId === userId,
		).length;

		const losses = matches.length - wins;

		return {
			stats: {
				played: matches.length,
				wins,
				losses,
				winRate:
					matches.length === 0
						? 0
						: Math.round(
								(wins / matches.length) *
									100,
							),
			},
			matches: matches.map((match) => {
				const userWasLeft =
					match.leftPlayerId === userId;

				const opponent = userWasLeft
					? match.rightPlayer
					: match.leftPlayer;

				return {
					id: match.id,
					mode: match.mode,
					result:
						match.winnerId === userId
							? "WIN"
							: "LOSS",
					userScore: userWasLeft
						? match.leftScore
						: match.rightScore,
					opponentScore: userWasLeft
						? match.rightScore
						: match.leftScore,
					opponent,
					finishedAt: match.finishedAt,
				};
			}),
		};
	}
}

export const matchService = new MatchService();
