import type {
	Request,
	Response,
} from "express";
import { conversationService } from "../services/conversation.service.js";
import { getIO } from "../socket/index.js";

export class ConversationController {
	async createOrGetPrivateConversation(
		request: Request,
		response: Response,
	): Promise<void> {
		const currentUserId = request.session.userId;

		if (currentUserId === undefined) {
			response.status(401).json({
				error: "Authentication required",
			});
			return;
		}

		const otherUserId = Number(request.body.userId);

		const result =
			await conversationService.createOrGetPrivateConversation(
				currentUserId,
				otherUserId,
			);

		if (result.created) {
			getIO()
				.to(`user:${otherUserId}`)
				.emit(
					"conversationCreated",
					result.conversation,
				);
		}

		response
			.status(result.created ? 201 : 200)
			.json({
				message: result.created
					? "Conversation created"
					: "Conversation found",
				conversation: result.conversation,
			});
	}

	async createGroupConversation(
		request: Request,
		response: Response,
	): Promise<void> {
		const ownerId = request.session.userId;

		if (ownerId === undefined) {
			response.status(401).json({
				error: "Authentication required",
			});
			return;
		}

		const conversation =
			await conversationService.createGroupConversation(
				ownerId,
				request.body.name,
				request.body.memberIds,
			);

		for (const participant of conversation.participants) {
			getIO()
				.to(`user:${participant.userId}`)
				.emit(
					"conversationCreated",
					conversation,
				);
		}

		response.status(201).json({
			message: "Group conversation created",
			conversation,
		});
	}

	async leaveGroupConversation(
		request: Request,
		response: Response,
	): Promise<void> {
		const userId = request.session.userId;

		if (userId === undefined) {
			response.status(401).json({
				error: "Authentication required",
			});
			return;
		}

		const conversationId = Number(
			request.params.conversationId,
		);

		const result =
			await conversationService.leaveGroupConversation(
				userId,
				conversationId,
			);

		getIO()
			.to(`user:${userId}`)
			.emit(
				"conversationDeleted",
				{
					conversationId,
				},
			);

		if (!result.deleted) {
			for (
				const participant
				of result.conversation.participants
			) {
				getIO()
					.to(`user:${participant.userId}`)
					.emit(
						"conversationUpdated",
						result.conversation,
					);
			}
		}

		response.status(200).json({
			message: result.deleted
				? "Group conversation deleted"
				: "You left the group",
			deleted: result.deleted,
			conversation: result.conversation,
		});
	}

	async removeGroupMember(
		request: Request,
		response: Response,
	): Promise<void> {
		const ownerId = request.session.userId;

		if (ownerId === undefined) {
			response.status(401).json({
				error: "Authentication required",
			});
			return;
		}

		const conversationId = Number(
			request.params.conversationId,
		);

		const memberId = Number(
			request.params.memberId,
		);

		const conversation =
			await conversationService.removeGroupMember(
				ownerId,
				conversationId,
				memberId,
			);

		for (const participant of conversation.participants) {
			getIO()
				.to(`user:${participant.userId}`)
				.emit(
					"conversationUpdated",
					conversation,
				);
		}

		getIO()
			.to(`user:${memberId}`)
			.emit(
				"conversationDeleted",
				{
					conversationId,
				},
			);

		response.status(200).json({
			message: "Member removed from group",
			conversation,
		});
	}

	async addGroupMember(
		request: Request,
		response: Response,
	): Promise<void> {
		const ownerId = request.session.userId;

		if (ownerId === undefined) {
			response.status(401).json({
				error: "Authentication required",
			});
			return;
		}

		const conversationId = Number(
			request.params.conversationId,
		);

		const memberId = request.body.memberId;

		const conversation =
			await conversationService.addGroupMember(
				ownerId,
				conversationId,
				memberId,
			);

		for (const participant of conversation.participants) {
			if (participant.userId === memberId) {
				continue;
			}

			getIO()
				.to(`user:${participant.userId}`)
				.emit(
					"conversationUpdated",
					conversation,
				);
		}

		getIO()
			.to(`user:${memberId}`)
			.emit(
				"conversationCreated",
				conversation,
			);

		response.status(200).json({
			message: "Member added to group",
			conversation,
		});
	}

	async renameGroupConversation(
		request: Request,
		response: Response,
	): Promise<void> {
		const userId = request.session.userId;

		if (userId === undefined) {
			response.status(401).json({
				error: "Authentication required",
			});
			return;
		}

		const conversationId = Number(
			request.params.conversationId,
		);

		const conversation =
			await conversationService.renameGroupConversation(
				userId,
				conversationId,
				request.body.name,
			);

		for (const participant of conversation.participants) {
			getIO()
				.to(`user:${participant.userId}`)
				.emit(
					"conversationUpdated",
					conversation,
				);
		}

		response.status(200).json({
			message: "Group conversation renamed",
			conversation,
		});
	}

	async getUserConversations(
		request: Request,
		response: Response,
	): Promise<void> {
		const userId = request.session.userId;

		if (userId === undefined) {
			response.status(401).json({
				error: "Authentication required",
			});
			return;
		}

		const conversations =
			await conversationService.getUserConversations(userId);

		response.status(200).json({
			conversations,
		});
	}


	async sendMessage(
		request: Request,
		response: Response,
	): Promise<void> {
		const userId = request.session.userId;

		if (userId === undefined) {
			response.status(401).json({
				error: "Authentication required",
			});
			return;
		}

		const conversationId = Number(
			request.params.conversationId,
		);

		const message =
			await conversationService.sendMessage(
				conversationId,
				userId,
				request.body.content,
			);

		response.status(201).json({
			message,
		});
	}


	async deleteConversation(
		request: Request,
		response: Response,
	): Promise<void> {
		const userId = request.session.userId;

		if (userId === undefined) {
			response.status(401).json({
				error: "Authentication required",
			});
			return;
		}

		const conversationId = Number(
			request.params.conversationId,
		);

		const conversation =
			await conversationService.deleteConversation(
				conversationId,
				userId,
			);

		for (const participant of conversation.participants) {
			getIO()
				.to(`user:${participant.userId}`)
				.emit(
					"conversationDeleted",
					{
						conversationId,
					},
				);
		}

		response.status(200).json({
			message: "Conversation deleted",
		});
	}



	async updateMessage(
		request: Request,
		response: Response,
	): Promise<void> {
		const userId = request.session.userId;

		if (userId === undefined) {
			response.status(401).json({
				error: "Authentication required",
			});
			return;
		}

		const messageId = Number(
			request.params.messageId,
		);

		const { content } = request.body;

		const message =
			await conversationService.updateMessage(
				messageId,
				userId,
				content,
			);

		getIO()
			.to(
				`conversation:${message.conversationId}`,
			)
			.emit("messageUpdated", message);

		response.status(200).json({
			message,
		});
	}

	async deleteMessage(
		request: Request,
		response: Response,
	): Promise<void> {
		const userId = request.session.userId;

		if (userId === undefined) {
			response.status(401).json({
				error: "Authentication required",
			});
			return;
		}

		const messageId = Number(
			request.params.messageId,
		);

		const message =
			await conversationService.deleteMessage(
				messageId,
				userId,
			);

		getIO()
			.to(
				`conversation:${message.conversationId}`,
			)
			.emit("messageDeleted", {
				id: message.id,
				conversationId:
					message.conversationId,
			});

		response.status(200).json({
			message: "Message deleted",
		});
	}

	async getMessages(
		request: Request,
		response: Response,
	): Promise<void> {
		const userId = request.session.userId;

		if (userId === undefined) {
			response.status(401).json({
				error: "Authentication required",
			});
			return;
		}

		const conversationId = Number(
			request.params.conversationId,
		);

		const limit =
			request.query.limit === undefined
				? 50
				: Number(request.query.limit);

		const before =
			request.query.before === undefined
				? undefined
				: Number(request.query.before);

		const messages =
			await conversationService.getMessages(
				conversationId,
				userId,
				limit,
				before,
			);

		response.status(200).json({
			messages,
		});
	}

}

export const conversationController =
	new ConversationController();
