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
