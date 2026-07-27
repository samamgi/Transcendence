import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";

type TournamentStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED";
type TournamentMatchStatus = "PENDING" | "COMPLETED";

type TournamentParticipant = {
	userId: number;
	username: string;
	displayName: string | null;
	joinedAt: Date;
};

type TournamentMatch = {
	id: string;
	round: 1 | 2;
	position: number;
	player1Id: number;
	player2Id: number;
	winnerId: number | null;
	player1Score: number | null;
	player2Score: number | null;
	status: TournamentMatchStatus;
};

type Tournament = {
	id: string;
	name: string;
	createdBy: number;
	status: TournamentStatus;
	winnerId: number | null;
	createdAt: Date;
	updatedAt: Date;
	participants: TournamentParticipant[];
	matches: TournamentMatch[];
};

type ReportMatchPayload = {
	winnerId: number;
	player1Score: number;
	player2Score: number;
};

export class TournamentService {
	private readonly tournaments = new Map<string, Tournament>();

	private cloneTournament(tournament: Tournament) {
		return {
			...tournament,
			participants: tournament.participants.map((participant) => ({
				...participant,
			})),
			matches: tournament.matches.map((match) => ({
				...match,
			})),
		};
	}

	private getTournamentOrThrow(tournamentId: string) {
		const tournament = this.tournaments.get(tournamentId);

		if (!tournament) {
			throw new HttpError(404, "Tournament not found");
		}

		return tournament;
	}

	private async getPublicUser(userId: number) {
		const user = await prisma.user.findUnique({
			where: {
				id: userId,
			},
			select: {
				id: true,
				username: true,
				displayName: true,
			},
		});

		if (!user) {
			throw new HttpError(404, "User not found");
		}

		return user;
	}

	private createSemiFinalMatches(participants: TournamentParticipant[]) {
		const [seed1, seed2, seed3, seed4] = participants;

		if (!seed1 || !seed2 || !seed3 || !seed4) {
			throw new HttpError(400, "Exactly 4 participants are required");
		}

		const firstSemiFinal: TournamentMatch = {
			id: randomUUID(),
			round: 1,
			position: 1,
			player1Id: seed1.userId,
			player2Id: seed4.userId,
			winnerId: null,
			player1Score: null,
			player2Score: null,
			status: "PENDING",
		};

		const secondSemiFinal: TournamentMatch = {
			id: randomUUID(),
			round: 1,
			position: 2,
			player1Id: seed2.userId,
			player2Id: seed3.userId,
			winnerId: null,
			player1Score: null,
			player2Score: null,
			status: "PENDING",
		};

		return [firstSemiFinal, secondSemiFinal];
	}

	private ensureFinalMatch(tournament: Tournament) {
		const semiFinals = tournament.matches.filter((match) => match.round === 1);

		if (semiFinals.length !== 2) {
			return;
		}

		const allSemiFinalsCompleted = semiFinals.every((match) => match.status === "COMPLETED" && match.winnerId !== null);

		if (!allSemiFinalsCompleted) {
			return;
		}

		const hasFinalMatch = tournament.matches.some((match) => match.round === 2);

		if (hasFinalMatch) {
			return;
		}

		const firstSemiFinal = semiFinals[0];
		const secondSemiFinal = semiFinals[1];

		if (!firstSemiFinal || !secondSemiFinal) {
			return;
		}

		const finalMatch: TournamentMatch = {
			id: randomUUID(),
			round: 2,
			position: 1,
			player1Id: firstSemiFinal.winnerId!,
			player2Id: secondSemiFinal.winnerId!,
			winnerId: null,
			player1Score: null,
			player2Score: null,
			status: "PENDING",
		};

		tournament.matches.push(finalMatch);
		tournament.updatedAt = new Date();
	}

	private finalizeTournamentIfPossible(tournament: Tournament) {
		const finalMatch = tournament.matches.find((match) => match.round === 2);

		if (!finalMatch || finalMatch.status !== "COMPLETED" || finalMatch.winnerId === null) {
			return;
		}

		tournament.status = "COMPLETED";
		tournament.winnerId = finalMatch.winnerId;
		tournament.updatedAt = new Date();
	}

	private validateScore(value: number, fieldName: string) {
		if (!Number.isInteger(value) || value < 0 || value > 20) {
			throw new HttpError(400, `Invalid ${fieldName}`);
		}
	}

	async createTournament(name: string, createdBy: number) {
		const normalizedName = name.trim();

		if (normalizedName.length < 3 || normalizedName.length > 64) {
			throw new HttpError(400, "Tournament name must contain 3 to 64 characters");
		}

		await this.getPublicUser(createdBy);

		const now = new Date();

		const tournament: Tournament = {
			id: randomUUID(),
			name: normalizedName,
			createdBy,
			status: "OPEN",
			winnerId: null,
			createdAt: now,
			updatedAt: now,
			participants: [],
			matches: [],
		};

		this.tournaments.set(tournament.id, tournament);

		return this.cloneTournament(tournament);
	}

	getActiveTournament() {
		const candidates = [...this.tournaments.values()].filter((tournament) => tournament.status !== "COMPLETED");

		if (candidates.length === 0) {
			return null;
		}

		candidates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		const activeTournament = candidates[0];

		if (!activeTournament) {
			return null;
		}

		return this.cloneTournament(activeTournament);
	}

	getTournament(tournamentId: string) {
		const tournament = this.getTournamentOrThrow(tournamentId);
		return this.cloneTournament(tournament);
	}

	async joinTournament(tournamentId: string, userId: number) {
		const tournament = this.getTournamentOrThrow(tournamentId);

		if (tournament.status !== "OPEN") {
			throw new HttpError(409, "Tournament registration is closed");
		}

		if (tournament.participants.some((participant) => participant.userId === userId)) {
			throw new HttpError(409, "User is already registered in this tournament");
		}

		if (tournament.participants.length >= 4) {
			throw new HttpError(409, "Tournament is full (4 participants maximum)");
		}

		const user = await this.getPublicUser(userId);

		tournament.participants.push({
			userId: user.id,
			username: user.username,
			displayName: user.displayName,
			joinedAt: new Date(),
		});

		tournament.updatedAt = new Date();

		return this.cloneTournament(tournament);
	}

	startTournament(tournamentId: string, userId: number) {
		const tournament = this.getTournamentOrThrow(tournamentId);

		if (tournament.createdBy !== userId) {
			throw new HttpError(403, "Only the creator can start the tournament");
		}

		if (tournament.status !== "OPEN") {
			throw new HttpError(409, "Tournament has already started");
		}

		if (tournament.participants.length !== 4) {
			throw new HttpError(400, "Tournament requires exactly 4 registered participants");
		}

		tournament.matches = this.createSemiFinalMatches(tournament.participants);
		tournament.status = "IN_PROGRESS";
		tournament.updatedAt = new Date();

		return this.cloneTournament(tournament);
	}

	reportMatchResult(
		tournamentId: string,
		matchId: string,
		reporterUserId: number,
		payload: ReportMatchPayload,
	) {
		const tournament = this.getTournamentOrThrow(tournamentId);

		if (tournament.status !== "IN_PROGRESS") {
			throw new HttpError(409, "Tournament is not in progress");
		}

		const match = tournament.matches.find((candidate) => candidate.id === matchId);

		if (!match) {
			throw new HttpError(404, "Match not found in tournament bracket");
		}

		if (match.status === "COMPLETED") {
			throw new HttpError(409, "Match result already reported");
		}

		const isReporterAuthorized =
			reporterUserId === tournament.createdBy ||
			reporterUserId === match.player1Id ||
			reporterUserId === match.player2Id;

		if (!isReporterAuthorized) {
			throw new HttpError(403, "Only tournament creator or match participants can report results");
		}

		const { winnerId, player1Score, player2Score } = payload;

		if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
			throw new HttpError(400, "Winner must be one of the two match participants");
		}

		this.validateScore(player1Score, "player1Score");
		this.validateScore(player2Score, "player2Score");

		if (player1Score === player2Score) {
			throw new HttpError(400, "Tournament matches cannot end in a draw");
		}

		if ((winnerId === match.player1Id && player1Score < player2Score) || (winnerId === match.player2Id && player2Score < player1Score)) {
			throw new HttpError(400, "Scores are inconsistent with winnerId");
		}

		match.winnerId = winnerId;
		match.player1Score = player1Score;
		match.player2Score = player2Score;
		match.status = "COMPLETED";
		tournament.updatedAt = new Date();

		this.ensureFinalMatch(tournament);
		this.finalizeTournamentIfPossible(tournament);

		return this.cloneTournament(tournament);
	}
}

export const tournamentService = new TournamentService();
