import { prisma } from "../lib/prisma.js";

export class ConversationRepository {
	async findPrivateConversation(
		user1Id: number,
		user2Id: number,
	) {
		const conversations =
			await prisma.conversation.findMany({
				where: {
					participants: {
						every: {
							userId: {
								in: [user1Id, user2Id],
							},
						},
					},
				},
				include: {
					participants: true,
				},
			});

		return conversations.find(
			(conversation) =>
				conversation.participants.length === 2,
		);
	}

	async createPrivateConversation(
		user1Id: number,
		user2Id: number,
	) {
		return prisma.conversation.create({
			data: {
				participants: {
					create: [
						{
							userId: user1Id,
						},
						{
							userId: user2Id,
						},
					],
				},
			},
			include: {
				participants: true,
			},
		});
	}

	async findUserConversations(userId: number) {
		const conversations =
			await prisma.conversation.findMany({
				where: {
					participants: {
						some: {
							userId,
						},
					},
				},
				include: {
					participants: {
						include: {
							user: {
								select: {
									id: true,
									username: true,
									displayName: true,
									avatarUrl: true,
								},
							},
						},
					},
					messages: {
						orderBy: {
							createdAt: "desc",
						},
						take: 1,
					},
				},
				orderBy: {
					updatedAt: "desc",
				},
			});

		if (conversations.length === 0) {
			return [];
		}

		const unreadMessageCounts =
			await prisma.message.groupBy({
				by: ["conversationId"],
				where: {
					OR: conversations.map(
						(conversation) => {
							const currentParticipant =
								conversation.participants.find(
									(participant) =>
										participant.userId === userId,
								);

							const lastReadMessageId =
								currentParticipant?.lastReadMessageId;

							return {
								conversationId: conversation.id,
								senderId: {
									not: userId,
								},
								...(lastReadMessageId !== null &&
								lastReadMessageId !== undefined
									? {
										id: {
											gt: lastReadMessageId,
										},
									}
									: {}),
							};
						},
					),
				},
				_count: {
					_all: true,
				},
			});

		const unreadCountByConversation =
			new Map(
				unreadMessageCounts.map((result) => [
					result.conversationId,
					result._count._all,
				]),
			);

		return conversations.map((conversation) => ({
			...conversation,
			unreadCount:
				unreadCountByConversation.get(
					conversation.id,
				) ?? 0,
		}));
	}


	async isParticipant(
		conversationId: number,
		userId: number,
	) {
		const participant =
			await prisma.conversationParticipant.findUnique({
				where: {
					conversationId_userId: {
						conversationId,
						userId,
					},
				},
			});

		return participant !== null;
	}

	async findConversationParticipantIds(
		conversationId: number,
	) {
		return prisma.conversation.findUnique({
			where: {
				id: conversationId,
			},
			select: {
				participants: {
					select: {
						userId: true,
					},
				},
			},
		});
	}

	async createMessage(
		conversationId: number,
		senderId: number,
		content: string,
	) {
		return prisma.message.create({
			data: {
				conversationId,
				senderId,
				content,
			},
			include: {
				sender: {
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


	async findMessages(
		conversationId: number,
		limit: number,
		before?: number,
	) {
		return prisma.message.findMany({
			where: {
				conversationId,
				...(before !== undefined
					? {
						id: {
							lt: before,
						},
					}
					: {}),
			},
			take: limit,
			orderBy: {
				id: "desc",
			},
			include: {
				sender: {
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

	async findMessageById(
		messageId: number,
	) {
		return prisma.message.findUnique({
			where: {
				id: messageId,
			},
		});
	}

	async markConversationRead(
		conversationId: number,
		userId: number,
		messageId: number,
	) {
		return prisma.conversationParticipant.update({
			where: {
				conversationId_userId: {
					conversationId,
					userId,
				},
			},
			data: {
				lastReadMessageId: messageId,
			},
		});
	}

}

export const conversationRepository =
	new ConversationRepository();
