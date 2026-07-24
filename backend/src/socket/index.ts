import type { Server as HttpServer } from "node:http";
import type { Session, SessionData } from "express-session";
import { Server } from "socket.io";
import { sessionMiddleware } from "../config/session.js";
import { conversationService } from "../services/conversation.service.js";

type SessionRequest = {
	session: Session &
		Partial<SessionData> & {
			userId?: number;
		};
};

type JoinConversationResponse = {
	success: boolean;
	error?: string;
};

type SendMessagePayload = {
	conversationId: number;
	content: string;
};

type SendMessageResponse = {
	success: boolean;
	message?: Awaited<
		ReturnType<typeof conversationService.sendMessage>
	>;
	error?: string;
};

type GetMessagesPayload = {
	conversationId: number;
	limit?: number;
	before?: number;
};

type GetMessagesResponse = {
	success: boolean;
	messages?: Awaited<
		ReturnType<typeof conversationService.getMessages>
	>;
	error?: string;
};

type TypingPayload = {
	conversationId: number;
};

type TypingEvent = {
	conversationId: number;
	userId: number;
};

let io: Server | undefined;

const connectedUsers = new Map<number, number>();

export function initializeSocket(
	server: HttpServer,
): Server {
	io = new Server(server, {
		cors: {
			origin: true,
			credentials: true,
		},
	});

	io.engine.use((
		request: any,
		response: any,
		next: any,
	) => {
		sessionMiddleware(
			request as Parameters<typeof sessionMiddleware>[0],
			response as Parameters<typeof sessionMiddleware>[1],
			(error?: unknown) => {
				if (error) {
					console.error(
						"ERREUR EXPRESS-SESSION SOCKET.IO :",
						error,
					);
				}

				next(
					error instanceof Error
						? error
						: error
							? new Error(String(error))
							: undefined,
				);
			},
		);
	});

	io.engine.on("connection_error", (error) => {
		console.error("ENGINE.IO CONNECTION ERROR");
		console.error("Code :", error.code);
		console.error("Message :", error.message);
		console.error("Contexte :", error.context);
		console.error("Méthode :", error.req?.method);
		console.error("URL :", error.req?.url);
		console.error("Transport :", error.req?._query?.transport);
		console.error("SID :", error.req?._query?.sid);
	});

	io.use((socket, next) => {
		const request =
			socket.request as typeof socket.request &
				SessionRequest;

		const userId = request.session?.userId;

		if (userId === undefined) {
			next(new Error("Unauthorized"));
			return;
		}

		next();
	});

	io.on("connection", (socket) => {
		const request =
			socket.request as typeof socket.request &
				SessionRequest;

		const userId = request.session.userId;

		if (userId === undefined) {
			socket.disconnect(true);
			return;
		}

		console.log(
			`User ${userId} connected (${socket.id})`,
		);

		void socket.join(`user:${userId}`);

		const currentConnectionCount =
			connectedUsers.get(userId) ?? 0;

		connectedUsers.set(
			userId,
			currentConnectionCount + 1,
		);

		if (currentConnectionCount === 0) {
			socket.broadcast.emit("userOnline", {
				userId,
			});
		}

		socket.on(
			"joinConversation",
			async (
				conversationId: number,
				callback?: (
					response: JoinConversationResponse,
				) => void,
			) => {
				try {
					await conversationService.ensureParticipant(
						conversationId,
						userId,
					);

					await socket.join(
						`conversation:${conversationId}`,
					);

					callback?.({
						success: true,
					});
				} catch (error) {
					callback?.({
						success: false,
						error:
							error instanceof Error
								? error.message
								: "Unable to join conversation",
					});
				}
			},
		);


		socket.on(
			"leaveConversation",
			async (
				conversationId: number,
				callback?: (
					response: JoinConversationResponse,
				) => void,
			) => {
				try {
					await conversationService.ensureParticipant(
						conversationId,
						userId,
					);

					await socket.leave(
						`conversation:${conversationId}`,
					);

					callback?.({
						success: true,
					});
				} catch (error) {
					callback?.({
						success: false,
						error:
							error instanceof Error
								? error.message
								: "Unable to leave conversation",
					});
				}
			},
		);

		socket.on(
			"sendMessage",
			async (
				payload: SendMessagePayload,
				callback?: (
					response: SendMessageResponse,
				) => void,
			) => {
				try {
					const message =
						await conversationService.sendMessage(
							payload?.conversationId,
							userId,
							payload?.content,
						);

					socket.nsp
						.to(
							`conversation:${message.conversationId}`,
						)
						.emit("newMessage", message);

					callback?.({
						success: true,
						message,
					});
				} catch (error) {
					callback?.({
						success: false,
						error:
							error instanceof Error
								? error.message
								: "Unable to send message",
					});
				}
			},
		);

		socket.on(
			"getMessages",
			async (
				payload: GetMessagesPayload,
				callback?: (
					response: GetMessagesResponse,
				) => void,
			) => {
				try {
					const messages =
						await conversationService.getMessages(
							payload?.conversationId,
							userId,
							payload?.limit,
							payload?.before,
						);

					callback?.({
						success: true,
						messages,
					});
				} catch (error) {
					callback?.({
						success: false,
						error:
							error instanceof Error
								? error.message
								: "Unable to get messages",
					});
				}
			},
		);

		const handleTypingEvent = async (
			event: "typing:start" | "typing:stop",
			payload: TypingPayload,
			callback?: (
				response: JoinConversationResponse,
			) => void,
		): Promise<void> => {
			try {
				const conversationId =
					payload?.conversationId;

				await conversationService.ensureParticipant(
					conversationId,
					userId,
				);

				const typingEvent: TypingEvent = {
					conversationId,
					userId,
				};

				socket
					.to(
						`conversation:${conversationId}`,
					)
					.emit(event, typingEvent);

				callback?.({
					success: true,
				});
			} catch (error) {
				callback?.({
					success: false,
					error:
						error instanceof Error
							? error.message
							: `Unable to emit ${event}`,
				});
			}
		};

		socket.on(
			"typing:start",
			(
				payload: TypingPayload,
				callback?: (
					response: JoinConversationResponse,
				) => void,
			) => {
				void handleTypingEvent(
					"typing:start",
					payload,
					callback,
				);
			},
		);

		socket.on(
			"typing:stop",
			(
				payload: TypingPayload,
				callback?: (
					response: JoinConversationResponse,
				) => void,
			) => {
				void handleTypingEvent(
					"typing:stop",
					payload,
					callback,
				);
			},
		);

		socket.on("disconnect", () => {
			console.log(
				`User ${userId} disconnected (${socket.id})`,
			);

			const currentConnectionCount =
				connectedUsers.get(userId) ?? 0;

			const nextConnectionCount =
				Math.max(0, currentConnectionCount - 1);

			if (nextConnectionCount === 0) {
				connectedUsers.delete(userId);

				socket.broadcast.emit("userOffline", {
					userId,
				});
			} else {
				connectedUsers.set(
					userId,
					nextConnectionCount,
				);
			}
		});
	});

	return io;
}

export function getIO(): Server {
	if (io === undefined) {
		throw new Error(
			"Socket.IO has not been initialized.",
		);
	}

	return io;
}
