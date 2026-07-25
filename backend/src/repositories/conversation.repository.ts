import { prisma } from "../lib/prisma.js";

export class ConversationRepository {
	async findPrivateConversation(
		user1Id: number,
		user2Id: number,
	) {
		const conversations =
			await prisma.conversation.findMany({
				where: {
					type: "PRIVATE",
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
				type: "PRIVATE",
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

	async createGroupConversation(
		ownerId: number,
		name: string,
		memberIds: number[],
	) {
		return prisma.conversation.create({
			data: {
				type: "GROUP",
				name,
				ownerId,
				participants: {
					create: [
						{
							userId: ownerId,
						},
						...memberIds.map((userId) => ({
							userId,
						})),
					],
				},
			},
			include: {
				owner: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true,
					},
				},
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
			},
		});
	}

	async findGroupConversation(
		conversationId: number,
	) {
		return prisma.conversation.findFirst({
			where: {
				id: conversationId,
				type: "GROUP",
			},
			select: {
				id: true,
				ownerId: true,
			},
		});
	}

	async findGroupForMembership(
		conversationId: number,
	) {
		return prisma.conversation.findFirst({
			where: {
				id: conversationId,
				type: "GROUP",
			},
			select: {
				id: true,
				ownerId: true,
				participants: {
					select: {
						userId: true,
					},
				},
			},
		});
	}

	async removeGroupMember(
		conversationId: number,
		userId: number,
	) {
		await prisma.conversationParticipant.deleteMany({
			where: {
				conversationId,
				userId,
			},
		});

		return prisma.conversation.findUniqueOrThrow({
			where: {
				id: conversationId,
			},
			include: {
				owner: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true,
					},
				},
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
			},
		});
	}

	async addGroupMember(
		conversationId: number,
		userId: number,
	) {
		await prisma.conversationParticipant.create({
			data: {
				conversationId,
				userId,
			},
		});

		return prisma.conversation.findUniqueOrThrow({
			where: {
				id: conversationId,
			},
			include: {
				owner: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true,
					},
				},
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
			},
		});
	}

	async updateGroupName(
		conversationId: number,
		name: string,
	) {
		return prisma.conversation.update({
			where: {
				id: conversationId,
			},
			data: {
				name,
			},
			include: {
				owner: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true,
					},
				},
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
					owner: {
						select: {
							id: true,
							username: true,
							displayName: true,
							avatarUrl: true,
						},
					},
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
		replyToId?: number,
	) {
		return prisma.message.create({
			data: {
				conversationId,
				senderId,
				content,
				...(replyToId !== undefined
					? { replyToId }
					: {}),
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
				replyTo: {
					select: {
						id: true,
						conversationId: true,
						senderId: true,
						content: true,
						createdAt: true,
						updatedAt: true,
						sender: {
							select: {
								id: true,
								username: true,
								displayName: true,
								avatarUrl: true,
							},
						},
					},
				},
			},
		});
	}


	async updateMessage(
		messageId: number,
		content: string,
	) {
		return prisma.message.update({
			where: {
				id: messageId,
			},
			data: {
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

	async deleteMessage(
		messageId: number,
	) {
		return prisma.message.delete({
			where: {
				id: messageId,
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
				reactions: {
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
					orderBy: {
						createdAt: "asc",
					},
				},
				replyTo: {
					select: {
						id: true,
						conversationId: true,
						senderId: true,
						content: true,
						createdAt: true,
						updatedAt: true,
						sender: {
							select: {
								id: true,
								username: true,
								displayName: true,
								avatarUrl: true,
							},
						},
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

	async findReaction(
		messageId: number,
		userId: number,
	) {
		return prisma.messageReaction.findUnique({
			where: {
				messageId_userId: {
					messageId,
					userId,
				},
			},
		});
	}

	async upsertReaction(
		messageId: number,
		userId: number,
		emoji: string,
	) {
		return prisma.messageReaction.upsert({
			where: {
				messageId_userId: {
					messageId,
					userId,
				},
			},
			update: {
				emoji,
			},
			create: {
				messageId,
				userId,
				emoji,
			},
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
		});
	}

	async deleteReaction(
		messageId: number,
		userId: number,
	) {
		return prisma.messageReaction.delete({
			where: {
				messageId_userId: {
					messageId,
					userId,
				},
			},
		});
	}


	async deleteConversation(
		conversationId: number,
	) {
		return prisma.conversation.delete({
			where: {
				id: conversationId,
			},
		});
	}

}

export const conversationRepository =
	new ConversationRepository();
