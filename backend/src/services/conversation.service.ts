import { HttpError } from "../lib/http-error.js";
import { blockRepository } from "../repositories/block.repository.js";
import { conversationRepository } from "../repositories/conversation.repository.js";
import { userRepository } from "../repositories/user.repository.js";

export class ConversationService {
	async createOrGetPrivateConversation(
		currentUserId: number,
		otherUserId: number,
	) {
		if (
			!Number.isInteger(otherUserId) ||
			otherUserId <= 0
		) {
			throw new HttpError(
				400,
				"Invalid user id",
			);
		}

		if (currentUserId === otherUserId) {
			throw new HttpError(
				400,
				"You cannot create a conversation with yourself",
			);
		}

		const otherUser =
			await userRepository.findById(otherUserId);

		if (!otherUser) {
			throw new HttpError(
				404,
				"User not found",
			);
		}

		const blocked =
			await blockRepository.isBlockedBetween(
				currentUserId,
				otherUserId,
			);

		if (blocked) {
			throw new HttpError(
				403,
				"You cannot create a conversation with this user",
			);
		}

		const existingConversation =
			await conversationRepository.findPrivateConversation(
				currentUserId,
				otherUserId,
			);

		if (existingConversation) {
			return {
				conversation: existingConversation,
				created: false,
			};
		}

		const conversation =
			await conversationRepository.createPrivateConversation(
				currentUserId,
				otherUserId,
			);

		return {
			conversation,
			created: true,
		};
	}

	async createGroupConversation(
		ownerId: number,
		name: unknown,
		memberIds: unknown,
	) {
		if (typeof name !== "string") {
			throw new HttpError(
				400,
				"Group name is required",
			);
		}

		const trimmedName = name.trim();

		if (trimmedName.length === 0) {
			throw new HttpError(
				400,
				"Group name cannot be empty",
			);
		}

		if (trimmedName.length > 100) {
			throw new HttpError(
				400,
				"Group name cannot exceed 100 characters",
			);
		}

		if (!Array.isArray(memberIds)) {
			throw new HttpError(
				400,
				"Group members must be an array",
			);
		}

		if (
			!memberIds.every(
				(memberId) =>
					Number.isInteger(memberId) &&
					memberId > 0,
			)
		) {
			throw new HttpError(
				400,
				"Invalid group member id",
			);
		}

		const uniqueMemberIds = [
			...new Set<number>(
				memberIds.filter(
					(memberId): memberId is number =>
						memberId !== ownerId,
				),
			),
		];

		if (uniqueMemberIds.length === 0) {
			throw new HttpError(
				400,
				"A group must contain at least one other member",
			);
		}

		if (uniqueMemberIds.length > 49) {
			throw new HttpError(
				400,
				"A group cannot contain more than 50 members",
			);
		}

		const users = await Promise.all(
			uniqueMemberIds.map((memberId) =>
				userRepository.findById(memberId),
			),
		);

		if (users.some((user) => user === null)) {
			throw new HttpError(
				404,
				"One or more users were not found",
			);
		}

		const blockStatuses = await Promise.all(
			uniqueMemberIds.map((memberId) =>
				blockRepository.isBlockedBetween(
					ownerId,
					memberId,
				),
			),
		);

		if (blockStatuses.some(Boolean)) {
			throw new HttpError(
				403,
				"You cannot add a blocked user to the group",
			);
		}

		return conversationRepository.createGroupConversation(
			ownerId,
			trimmedName,
			uniqueMemberIds,
		);
	}

	async getUserConversations(userId: number) {
		const conversations =
			await conversationRepository.findUserConversations(userId);

		return conversations.map((conversation) => {
			const otherParticipant =
				conversation.participants.find(
					(participant) => participant.userId !== userId,
				);

			return {
				id: conversation.id,
				createdAt: conversation.createdAt,
				updatedAt: conversation.updatedAt,
				otherUser: otherParticipant?.user ?? null,
				lastMessage: conversation.messages[0] ?? null,
				unreadCount: conversation.unreadCount,
			};
		});
	}


	async sendMessage(
		conversationId: number,
		userId: number,
		content: string,
		replyToId?: number,
	) {
		if (
			!Number.isInteger(conversationId) ||
			conversationId <= 0
		) {
			throw new HttpError(
				400,
				"Invalid conversation id",
			);
		}

		if (typeof content !== "string") {
			throw new HttpError(
				400,
				"Message content is required",
			);
		}

		const trimmedContent = content.trim();

		if (trimmedContent.length === 0) {
			throw new HttpError(
				400,
				"Message content cannot be empty",
			);
		}

		if (trimmedContent.length > 2000) {
			throw new HttpError(
				400,
				"Message content cannot exceed 2000 characters",
			);
		}

		if (
			replyToId !== undefined &&
			(
				!Number.isInteger(replyToId) ||
				replyToId <= 0
			)
		) {
			throw new HttpError(
				400,
				"Invalid reply message id",
			);
		}

		const isParticipant =
			await conversationRepository.isParticipant(
				conversationId,
				userId,
			);

		if (!isParticipant) {
			throw new HttpError(
				403,
				"You are not a participant in this conversation",
			);
		}

		const conversation =
			await conversationRepository.findConversationParticipantIds(
				conversationId,
			);

		if (!conversation) {
			throw new HttpError(
				404,
				"Conversation not found",
			);
		}

		const otherParticipant =
			conversation.participants.find(
				(participant) =>
					participant.userId !== userId,
			);

		if (!otherParticipant) {
			throw new HttpError(
				400,
				"Conversation has no other participant",
			);
		}

		const blocked =
			await blockRepository.isBlockedBetween(
				userId,
				otherParticipant.userId,
			);

		if (blocked) {
			throw new HttpError(
				403,
				"You cannot send messages to this user",
			);
		}

		if (replyToId !== undefined) {
			const replyToMessage =
				await conversationRepository.findMessageById(
					replyToId,
				);

			if (!replyToMessage) {
				throw new HttpError(
					404,
					"Reply message not found",
				);
			}

			if (
				replyToMessage.conversationId !==
				conversationId
			) {
				throw new HttpError(
					400,
					"Reply message does not belong to this conversation",
				);
			}
		}

		return conversationRepository.createMessage(
			conversationId,
			userId,
			trimmedContent,
			replyToId,
		);
	}


	async updateMessage(
		messageId: number,
		userId: number,
		content: string,
	) {
		if (
			!Number.isInteger(messageId) ||
			messageId <= 0
		) {
			throw new HttpError(
				400,
				"Invalid message id",
			);
		}

		const trimmedContent = content.trim();

		if (trimmedContent.length === 0) {
			throw new HttpError(
				400,
				"Message content is required",
			);
		}

		const message =
			await conversationRepository.findMessageById(
				messageId,
			);

		if (!message) {
			throw new HttpError(
				404,
				"Message not found",
			);
		}

		if (message.senderId !== userId) {
			throw new HttpError(
				403,
				"You can only edit your own messages",
			);
		}

		return conversationRepository.updateMessage(
			messageId,
			trimmedContent,
		);
	}

	async addMessageReaction(
		messageId: number,
		userId: number,
		emoji: string,
	) {
		if (
			!Number.isInteger(messageId) ||
			messageId <= 0
		) {
			throw new HttpError(
				400,
				"Invalid message id",
			);
		}

		if (typeof emoji !== "string") {
			throw new HttpError(
				400,
				"Emoji is required",
			);
		}

		const allowedEmojis = [
			"👍",
			"❤️",
			"😂",
			"😮",
			"😢",
			"😡",
		];

		if (!allowedEmojis.includes(emoji)) {
			throw new HttpError(
				400,
				"Unsupported emoji",
			);
		}

		const message =
			await conversationRepository.findMessageById(
				messageId,
			);

		if (!message) {
			throw new HttpError(
				404,
				"Message not found",
			);
		}

		const isParticipant =
			await conversationRepository.isParticipant(
				message.conversationId,
				userId,
			);

		if (!isParticipant) {
			throw new HttpError(
				403,
				"You are not a participant in this conversation",
			);
		}

		const reaction =
			await conversationRepository.upsertReaction(
				messageId,
				userId,
				emoji,
			);

		return {
			...reaction,
			conversationId: message.conversationId,
		};
	}

	async removeMessageReaction(
		messageId: number,
		userId: number,
	) {
		if (
			!Number.isInteger(messageId) ||
			messageId <= 0
		) {
			throw new HttpError(
				400,
				"Invalid message id",
			);
		}

		const message =
			await conversationRepository.findMessageById(
				messageId,
			);

		if (!message) {
			throw new HttpError(
				404,
				"Message not found",
			);
		}

		const isParticipant =
			await conversationRepository.isParticipant(
				message.conversationId,
				userId,
			);

		if (!isParticipant) {
			throw new HttpError(
				403,
				"You are not a participant in this conversation",
			);
		}

		const reaction =
			await conversationRepository.findReaction(
				messageId,
				userId,
			);

		if (!reaction) {
			throw new HttpError(
				404,
				"Reaction not found",
			);
		}

		await conversationRepository.deleteReaction(
			messageId,
			userId,
		);

		return {
			messageId,
			conversationId: message.conversationId,
			userId,
		};
	}


	async deleteMessage(
		messageId: number,
		userId: number,
	) {
		if (
			!Number.isInteger(messageId) ||
			messageId <= 0
		) {
			throw new HttpError(
				400,
				"Invalid message id",
			);
		}

		const message =
			await conversationRepository.findMessageById(
				messageId,
			);

		if (!message) {
			throw new HttpError(
				404,
				"Message not found",
			);
		}

		if (message.senderId !== userId) {
			throw new HttpError(
				403,
				"You can only delete your own messages",
			);
		}

		return conversationRepository.deleteMessage(
			messageId,
		);
	}

	async getMessages(
		conversationId: number,
		userId: number,
		limit = 50,
		before?: number,
	) {
		if (
			!Number.isInteger(conversationId) ||
			conversationId <= 0
		) {
			throw new HttpError(
				400,
				"Invalid conversation id",
			);
		}

		if (
			!Number.isInteger(limit) ||
			limit <= 0 ||
			limit > 100
		) {
			throw new HttpError(
				400,
				"Limit must be between 1 and 100",
			);
		}

		if (
			before !== undefined &&
			(!Number.isInteger(before) || before <= 0)
		) {
			throw new HttpError(
				400,
				"Invalid before message id",
			);
		}

		const isParticipant =
			await conversationRepository.isParticipant(
				conversationId,
				userId,
			);

		if (!isParticipant) {
			throw new HttpError(
				403,
				"You are not a participant in this conversation",
			);
		}

		const messages =
			await conversationRepository.findMessages(
				conversationId,
				limit,
				before,
			);

		return messages.reverse();
	}


	async markConversationRead(
		conversationId: number,
		userId: number,
		messageId: number,
	) {
		if (
			!Number.isInteger(conversationId) ||
			conversationId <= 0
		) {
			throw new HttpError(
				400,
				"Invalid conversation id",
			);
		}

		if (
			!Number.isInteger(messageId) ||
			messageId <= 0
		) {
			throw new HttpError(
				400,
				"Invalid message id",
			);
		}

		const isParticipant =
			await conversationRepository.isParticipant(
				conversationId,
				userId,
			);

		if (!isParticipant) {
			throw new HttpError(
				403,
				"You are not a participant in this conversation",
			);
		}

		const message =
			await conversationRepository.findMessageById(
				messageId,
			);

		if (!message) {
			throw new HttpError(
				404,
				"Message not found",
			);
		}

		if (message.conversationId !== conversationId) {
			throw new HttpError(
				400,
				"Message does not belong to this conversation",
			);
		}

		return conversationRepository.markConversationRead(
			conversationId,
			userId,
			messageId,
		);
	}


	async deleteConversation(
		conversationId: number,
		userId: number,
	) {
		if (
			!Number.isInteger(conversationId) ||
			conversationId <= 0
		) {
			throw new HttpError(
				400,
				"Invalid conversation id",
			);
		}

		const isParticipant =
			await conversationRepository.isParticipant(
				conversationId,
				userId,
			);

		if (!isParticipant) {
			throw new HttpError(
				403,
				"You are not a participant in this conversation",
			);
		}

		const conversation =
			await conversationRepository.findConversationParticipantIds(
				conversationId,
			);

		if (!conversation) {
			throw new HttpError(
				404,
				"Conversation not found",
			);
		}

		await conversationRepository.deleteConversation(
			conversationId,
		);

		return conversation;
	}



	async ensureParticipant(
		conversationId: number,
		userId: number,
	): Promise<void> {
		if (
			!Number.isInteger(conversationId) ||
			conversationId <= 0
		) {
			throw new HttpError(
				400,
				"Invalid conversation id",
			);
		}

		const participant =
			await conversationRepository.isParticipant(
				conversationId,
				userId,
			);

		if (!participant) {
			throw new HttpError(
				403,
				"You are not a participant in this conversation",
			);
		}
	}

}

export const conversationService =
	new ConversationService();
