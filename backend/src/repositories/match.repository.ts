import { prisma } from "../lib/prisma.js";

type CreateOnlineMatchData = {
	leftPlayerId: number;
	rightPlayerId: number;
	winnerId: number;
	leftScore: number;
	rightScore: number;
};

export class MatchRepository {
	async createOnlineMatch(
		data: CreateOnlineMatchData,
	) {
		return prisma.match.create({
			data: {
				mode: "ONLINE",
				...data,
			},
		});
	}

	async findUserMatches(userId: number) {
		return prisma.match.findMany({
			where: {
				OR: [
					{
						leftPlayerId: userId,
					},
					{
						rightPlayerId: userId,
					},
				],
			},
			orderBy: {
				finishedAt: "desc",
			},
			take: 20,
			include: {
				leftPlayer: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true,
					},
				},
				rightPlayer: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true,
					},
				},
			},
		});
	}
}

export const matchRepository =
	new MatchRepository();
