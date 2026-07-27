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
