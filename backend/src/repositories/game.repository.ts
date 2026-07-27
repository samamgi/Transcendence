import { prisma } from "../lib/prisma.js";

type CreateGameMatchData = {
	mode: "AI" | "ONLINE";
	status: "FINISHED" | "FORFEIT";
	player1Id: number;
	player2Id?: number;
	winnerId?: number;
	player1Score: number;
	player2Score: number;
	startedAt?: Date;
};

export class GameRepository {
	async createMatch(data: CreateGameMatchData) {
		return prisma.gameMatch.create({
			data: {
				mode: data.mode,
				status: data.status,
				player1Id: data.player1Id,
				...(data.player2Id !== undefined
					? {
						player2Id: data.player2Id,
					}
					: {}),
				...(data.winnerId !== undefined
					? {
						winnerId: data.winnerId,
					}
					: {}),
				player1Score: data.player1Score,
				player2Score: data.player2Score,
				...(data.startedAt !== undefined
					? {
						startedAt: data.startedAt,
					}
					: {}),
			},
		});
	}

	async getUserMatches(
		userId: number,
		limit = 20,
	) {
		return prisma.gameMatch.findMany({
			where: {
				OR: [
					{
						player1Id: userId,
					},
					{
						player2Id: userId,
					},
				],
			},
			orderBy: {
				finishedAt: "desc",
			},
			take: limit,
			include: {
				player1: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true,
					},
				},
				player2: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true,
					},
				},
				winner: {
					select: {
						id: true,
						username: true,
						displayName: true,
					},
				},
			},
		});
	}

	async getUserMatchTotals(userId: number) {
		const [
			total,
			wins,
			forfeits,
		] = await Promise.all([
			prisma.gameMatch.count({
				where: {
					OR: [
						{
							player1Id: userId,
						},
						{
							player2Id: userId,
						},
					],
				},
			}),
			prisma.gameMatch.count({
				where: {
					winnerId: userId,
				},
			}),
			prisma.gameMatch.count({
				where: {
					status: "FORFEIT",
					winnerId: {
						not: userId,
					},
					OR: [
						{
							player1Id: userId,
						},
						{
							player2Id: userId,
						},
					],
				},
			}),
		]);

		return {
			total,
			wins,
			forfeits,
		};
	}
}

export const gameRepository =
	new GameRepository();
