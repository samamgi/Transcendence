import { HttpError } from "../lib/http-error.js";
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
			};
		});
	}


	async sendMessage(
		conversationId: number,
		userId: number,
		content: string,
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

		return conversationRepository.createMessage(
			conversationId,
			userId,
			trimmedContent,
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
