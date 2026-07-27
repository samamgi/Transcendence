import { prisma } from "../lib/prisma.js";

export class UserRepository {
	async create(data: {
		username: string;
		email: string;
		passwordHash: string;
	}) {
		return prisma.user.create({
			data,
			omit: {
				passwordHash: true,
			},
		});
	}

	async findById(id: number) {
		return prisma.user.findUnique({
			where: { id },
			omit: {
				passwordHash: true,
			},
		});
	}

	async findPublicById(id: number) {
		return prisma.user.findUnique({
			where: { id },
			select: {
				id: true,
				username: true,
				displayName: true,
				avatarUrl: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	}

	async findByEmail(email: string) {
		return prisma.user.findUnique({
			where: { email },
		});
	}

	async findByUsername(username: string) {
		return prisma.user.findUnique({
			where: { username },
		});
	}

	async updateProfile(
		id: number,
		data: {
			username?: string;
			displayName?: string | null;
		},
	) {
		return prisma.user.update({
			where: { id },
			data,
			omit: {
				passwordHash: true,
			},
		});
	}

	async updateAvatar(
		id: number,
		avatarUrl: string,
	) {
		return prisma.user.update({
			where: { id },
			data: {
				avatarUrl,
			},
			omit: {
				passwordHash: true,
			},
		});
	}

	async deleteAccount(userId: number) {
		return prisma.$transaction(async (transaction) => {
			const user = await transaction.user.findUnique({
				where: {
					id: userId,
				},
				select: {
					id: true,
					avatarUrl: true,
					conversationParticipants: {
						select: {
							conversationId: true,
							conversation: {
								select: {
									type: true,
								},
							},
						},
					},
					ownedConversations: {
						where: {
							type: "GROUP",
						},
						select: {
							id: true,
							participants: {
								where: {
									userId: {
										not: userId,
									},
								},
								orderBy: {
									joinedAt: "asc",
								},
								take: 1,
								select: {
									userId: true,
								},
							},
						},
					},
				},
			});

			if (!user) {
				return null;
			}

			const privateConversationIds =
				user.conversationParticipants
					.filter(
						(participant) =>
							participant.conversation.type ===
							"PRIVATE",
					)
					.map(
						(participant) =>
							participant.conversationId,
					);

			if (privateConversationIds.length > 0) {
				await transaction.conversation.deleteMany({
					where: {
						id: {
							in: privateConversationIds,
						},
					},
				});
			}

			for (
				const conversation
				of user.ownedConversations
			) {
				const nextOwnerId =
					conversation.participants[0]?.userId;

				if (nextOwnerId === undefined) {
					await transaction.conversation.delete({
						where: {
							id: conversation.id,
						},
					});
				} else {
					await transaction.conversation.update({
						where: {
							id: conversation.id,
						},
						data: {
							ownerId: nextOwnerId,
						},
					});
				}
			}

			await transaction.user.delete({
				where: {
					id: userId,
				},
			});

			await transaction.conversation.deleteMany({
				where: {
					participants: {
						none: {},
					},
				},
			});

			return {
				avatarUrl: user.avatarUrl,
			};
		});
	}

	async getGameStatistics(userId: number) {
		type SummaryRow = {
			played: bigint;
			wins: bigint;
			losses: bigint;
		};

		type HistoryRow = {
			id: number;
			mode: string;
			status: string;
			player1Id: number;
			player2Id: number | null;
			winnerId: number | null;
			player1Score: number;
			player2Score: number;
			finishedAt: Date;
			opponentUsername: string | null;
			opponentDisplayName: string | null;
		};

		const [summary] =
			await prisma.$queryRaw<SummaryRow[]>`
				SELECT
					COUNT(*)::bigint AS "played",
					COUNT(*) FILTER (
						WHERE "winnerId" = ${userId}
					)::bigint AS "wins",
					COUNT(*) FILTER (
						WHERE "winnerId" IS NOT NULL
						AND "winnerId" <> ${userId}
					)::bigint AS "losses"
				FROM "GameMatch"
				WHERE
					"player1Id" = ${userId}
					OR "player2Id" = ${userId}
			`;

		const history =
			await prisma.$queryRaw<HistoryRow[]>`
				SELECT
					match."id",
					match."mode"::text AS "mode",
					match."status"::text AS "status",
					match."player1Id",
					match."player2Id",
					match."winnerId",
					match."player1Score",
					match."player2Score",
					match."finishedAt",
					opponent."username"
						AS "opponentUsername",
					opponent."displayName"
						AS "opponentDisplayName"
				FROM "GameMatch" AS match
				LEFT JOIN "User" AS opponent
					ON opponent."id" =
						CASE
							WHEN match."player1Id" = ${userId}
								THEN match."player2Id"
							ELSE match."player1Id"
						END
				WHERE
					match."player1Id" = ${userId}
					OR match."player2Id" = ${userId}
				ORDER BY match."finishedAt" DESC
				LIMIT 10
			`;

		return {
			played: Number(summary?.played ?? 0n),
			wins: Number(summary?.wins ?? 0n),
			losses: Number(summary?.losses ?? 0n),
			history,
		};
	}

	async searchUsers(
		userId: number,
		query: string,
	) {
		const users = await prisma.user.findMany({
			where: {
				AND: [
					{
						id: {
							not: userId,
						},
					},
					{
						OR: [
							{
								username: {
									contains: query,
									mode: "insensitive",
								},
							},
							{
								displayName: {
									contains: query,
									mode: "insensitive",
								},
							},
						],
					},
				],
			},
			select: {
				id: true,
				username: true,
				displayName: true,
				avatarUrl: true,
			},
			take: 10,
			orderBy: {
				username: "asc",
			},
		});

		if (users.length === 0) {
			return [];
		}

		const resultUserIds = users.map(
			(user) => user.id,
		);

		const [friendships, requests] =
			await Promise.all([
				prisma.friend.findMany({
					where: {
						OR: [
							{
								user1Id: userId,
								user2Id: {
									in: resultUserIds,
								},
							},
							{
								user2Id: userId,
								user1Id: {
									in: resultUserIds,
								},
							},
						],
					},
					select: {
						user1Id: true,
						user2Id: true,
					},
				}),
				prisma.friendRequest.findMany({
					where: {
						status: "PENDING",
						OR: [
							{
								senderId: userId,
								receiverId: {
									in: resultUserIds,
								},
							},
							{
								receiverId: userId,
								senderId: {
									in: resultUserIds,
								},
							},
						],
					},
					select: {
						senderId: true,
						receiverId: true,
					},
				}),
			]);

		const friendIds = new Set<number>();

		for (const friendship of friendships) {
			friendIds.add(
				friendship.user1Id === userId
					? friendship.user2Id
					: friendship.user1Id,
			);
		}

		const sentRequestIds = new Set<number>();
		const receivedRequestIds = new Set<number>();

		for (const request of requests) {
			if (request.senderId === userId) {
				sentRequestIds.add(request.receiverId);
			} else {
				receivedRequestIds.add(request.senderId);
			}
		}

		return users.map((user) => {
			let relationship:
				| "NONE"
				| "PENDING_SENT"
				| "PENDING_RECEIVED"
				| "FRIEND" = "NONE";

			if (friendIds.has(user.id)) {
				relationship = "FRIEND";
			} else if (sentRequestIds.has(user.id)) {
				relationship = "PENDING_SENT";
			} else if (
				receivedRequestIds.has(user.id)
			) {
				relationship = "PENDING_RECEIVED";
			}

			return {
				...user,
				relationship,
			};
		});
	}
}

export const userRepository =
	new UserRepository();
