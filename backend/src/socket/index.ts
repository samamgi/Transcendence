import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import type { Session, SessionData } from "express-session";
import { Server } from "socket.io";
import { sessionMiddleware } from "../config/session.js";
import { conversationService } from "../services/conversation.service.js";
import { friendService } from "../services/friend.service.js";

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
	replyToId?: number;
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

type MarkConversationReadPayload = {
	conversationId: number;
	messageId: number;
};

type MarkConversationReadResponse = {
	success: boolean;
	error?: string;
};

type MessageReadEvent = {
	conversationId: number;
	userId: number;
	messageId: number;
};

type AddReactionPayload = {
	messageId: number;
	emoji: string;
};

type RemoveReactionPayload = {
	messageId: number;
};

type ReactionResponse = {
	success: boolean;
	reaction?: Awaited<
		ReturnType<
			typeof conversationService.addMessageReaction
		>
	>;
	removedReaction?: Awaited<
		ReturnType<
			typeof conversationService.removeMessageReaction
		>
	>;
	error?: string;
};

type TypingEvent = {
	conversationId: number;
	userId: number;
};

type GetOnlineFriendsResponse = {
	success: boolean;
	userIds?: number[];
	error?: string;
};

type OnlineQueueResponse = {
	success: boolean;
	status?: "waiting" | "matched" | "idle";
	error?: string;
};

type OnlineMatchFoundEvent = {
	roomId: string;
	side: "left" | "right";
	opponentUserId: number;
};

type OnlinePaddleMovePayload = {
	y: number;
};

type OnlinePaddleMovedEvent = {
	y: number;
};

type OnlineSide = "left" | "right";

type OnlineGameStateEvent = {
	roomId: string;
	leftPaddleY: number;
	rightPaddleY: number;
	ballX: number;
	ballY: number;
	leftScore: number;
	rightScore: number;
	winner: OnlineSide | null;
};

type OnlineGame = {
	roomId: string;
	leftPaddleY: number;
	rightPaddleY: number;
	ballX: number;
	ballY: number;
	ballVelocityX: number;
	ballVelocityY: number;
	leftScore: number;
	rightScore: number;
	winner: OnlineSide | null;
	interval: ReturnType<typeof setInterval>;
};

const ONLINE_FIELD_WIDTH = 900;
const ONLINE_FIELD_HEIGHT = 500;
const ONLINE_PADDLE_WIDTH = 14;
const ONLINE_PADDLE_HEIGHT = 92;
const ONLINE_BALL_SIZE = 16;
const ONLINE_INITIAL_BALL_SPEED = 330;
const ONLINE_WINNING_SCORE = 5;
const ONLINE_LEFT_PADDLE_X = 24;
const ONLINE_RIGHT_PADDLE_X =
	ONLINE_FIELD_WIDTH -
	ONLINE_PADDLE_WIDTH -
	24;

let io: Server | undefined;

const connectedUsers = new Map<number, number>();

let waitingOnlineSocketId: string | null = null;

const onlineRoomBySocketId =
	new Map<string, string>();

const onlineSideBySocketId =
	new Map<string, OnlineSide>();

const onlineGames =
	new Map<string, OnlineGame>();

function resetOnlineBall(
	game: OnlineGame,
	direction: 1 | -1,
): void {
	game.ballX =
		ONLINE_FIELD_WIDTH / 2 -
		ONLINE_BALL_SIZE / 2;

	game.ballY =
		ONLINE_FIELD_HEIGHT / 2 -
		ONLINE_BALL_SIZE / 2;

	game.ballVelocityX =
		ONLINE_INITIAL_BALL_SPEED * direction;

	game.ballVelocityY =
		ONLINE_INITIAL_BALL_SPEED *
		(Math.random() > 0.5 ? 0.45 : -0.45);
}

function emitOnlineGameState(
	server: Server,
	game: OnlineGame,
): void {
	const event: OnlineGameStateEvent = {
		roomId: game.roomId,
		leftPaddleY: game.leftPaddleY,
		rightPaddleY: game.rightPaddleY,
		ballX: game.ballX,
		ballY: game.ballY,
		leftScore: game.leftScore,
		rightScore: game.rightScore,
		winner: game.winner,
	};

	server
		.to(`pong:${game.roomId}`)
		.emit("online:gameState", event);
}

function stopOnlineGame(roomId: string): void {
	const game = onlineGames.get(roomId);

	if (!game) {
		return;
	}

	clearInterval(game.interval);
	onlineGames.delete(roomId);
}

function createOnlineGame(
	server: Server,
	roomId: string,
): OnlineGame {
	const initialPaddleY =
		ONLINE_FIELD_HEIGHT / 2 -
		ONLINE_PADDLE_HEIGHT / 2;

	const game: OnlineGame = {
		roomId,
		leftPaddleY: initialPaddleY,
		rightPaddleY: initialPaddleY,
		ballX:
			ONLINE_FIELD_WIDTH / 2 -
			ONLINE_BALL_SIZE / 2,
		ballY:
			ONLINE_FIELD_HEIGHT / 2 -
			ONLINE_BALL_SIZE / 2,
		ballVelocityX: ONLINE_INITIAL_BALL_SPEED,
		ballVelocityY:
			ONLINE_INITIAL_BALL_SPEED * 0.45,
		leftScore: 0,
		rightScore: 0,
		winner: null,
		interval: setInterval(() => undefined, 1000),
	};

	clearInterval(game.interval);

	let previousTime = Date.now();

	game.interval = setInterval(() => {
		if (game.winner) {
			emitOnlineGameState(server, game);
			return;
		}

		const currentTime = Date.now();

		const deltaTime = Math.min(
			(currentTime - previousTime) / 1000,
			0.03,
		);

		previousTime = currentTime;

		game.ballX +=
			game.ballVelocityX * deltaTime;

		game.ballY +=
			game.ballVelocityY * deltaTime;

		if (game.ballY <= 0) {
			game.ballY = 0;
			game.ballVelocityY =
				Math.abs(game.ballVelocityY);
		}

		if (
			game.ballY + ONLINE_BALL_SIZE >=
			ONLINE_FIELD_HEIGHT
		) {
			game.ballY =
				ONLINE_FIELD_HEIGHT -
				ONLINE_BALL_SIZE;

			game.ballVelocityY =
				-Math.abs(game.ballVelocityY);
		}

		const leftCollision =
			game.ballVelocityX < 0 &&
			game.ballX <=
				ONLINE_LEFT_PADDLE_X +
				ONLINE_PADDLE_WIDTH &&
			game.ballX + ONLINE_BALL_SIZE >=
				ONLINE_LEFT_PADDLE_X &&
			game.ballY + ONLINE_BALL_SIZE >=
				game.leftPaddleY &&
			game.ballY <=
				game.leftPaddleY +
				ONLINE_PADDLE_HEIGHT;

		if (leftCollision) {
			const paddleCenter =
				game.leftPaddleY +
				ONLINE_PADDLE_HEIGHT / 2;

			const ballCenter =
				game.ballY +
				ONLINE_BALL_SIZE / 2;

			const impact =
				(ballCenter - paddleCenter) /
				(ONLINE_PADDLE_HEIGHT / 2);

			game.ballX =
				ONLINE_LEFT_PADDLE_X +
				ONLINE_PADDLE_WIDTH;

			game.ballVelocityX =
				Math.abs(
					game.ballVelocityX * 1.04,
				);

			game.ballVelocityY =
				impact *
				ONLINE_INITIAL_BALL_SPEED;
		}

		const rightCollision =
			game.ballVelocityX > 0 &&
			game.ballX + ONLINE_BALL_SIZE >=
				ONLINE_RIGHT_PADDLE_X &&
			game.ballX <=
				ONLINE_RIGHT_PADDLE_X +
				ONLINE_PADDLE_WIDTH &&
			game.ballY + ONLINE_BALL_SIZE >=
				game.rightPaddleY &&
			game.ballY <=
				game.rightPaddleY +
				ONLINE_PADDLE_HEIGHT;

		if (rightCollision) {
			const paddleCenter =
				game.rightPaddleY +
				ONLINE_PADDLE_HEIGHT / 2;

			const ballCenter =
				game.ballY +
				ONLINE_BALL_SIZE / 2;

			const impact =
				(ballCenter - paddleCenter) /
				(ONLINE_PADDLE_HEIGHT / 2);

			game.ballX =
				ONLINE_RIGHT_PADDLE_X -
				ONLINE_BALL_SIZE;

			game.ballVelocityX =
				-Math.abs(
					game.ballVelocityX * 1.04,
				);

			game.ballVelocityY =
				impact *
				ONLINE_INITIAL_BALL_SPEED;
		}

		if (
			game.ballX + ONLINE_BALL_SIZE < 0
		) {
			game.rightScore += 1;

			if (
				game.rightScore >=
				ONLINE_WINNING_SCORE
			) {
				game.winner = "right";
			} else {
				resetOnlineBall(game, -1);
			}
		}

		if (game.ballX > ONLINE_FIELD_WIDTH) {
			game.leftScore += 1;

			if (
				game.leftScore >=
				ONLINE_WINNING_SCORE
			) {
				game.winner = "left";
			} else {
				resetOnlineBall(game, 1);
			}
		}

		emitOnlineGameState(server, game);
	}, 1000 / 60);

	onlineGames.set(roomId, game);

	return game;
}

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
			"getOnlineFriends",
			async (
				callback?: (
					response: GetOnlineFriendsResponse,
				) => void,
			) => {
				try {
					const friends =
						await friendService.getFriends(userId);

					const userIds = friends
						.filter((friend) =>
							connectedUsers.has(friend.id),
						)
						.map((friend) => friend.id);

					callback?.({
						success: true,
						userIds,
					});
				} catch (error) {
					callback?.({
						success: false,
						error:
							error instanceof Error
								? error.message
								: "Unable to get online friends",
					});
				}
			},
		);

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
							payload?.replyToId,
						);

					socket.nsp
						.to(
							`conversation:${message.conversationId}`,
						)
						.emit("newMessage", message);

					const participantUserIds =
						await conversationService
							.getParticipantUserIds(
								message.conversationId,
							);

					for (
						const participantUserId
							of participantUserIds
					) {
						if (
							participantUserId === userId
						) {
							continue;
						}

						socket.nsp
							.to(
								`user:${participantUserId}`,
							)
							.emit(
								"social:newMessage",
								message,
							);
					}

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


		socket.on(
			"message:addReaction",
			async (
				payload: AddReactionPayload,
				callback?: (
					response: ReactionResponse,
				) => void,
			) => {
				try {
					const reaction =
						await conversationService.addMessageReaction(
							payload?.messageId,
							userId,
							payload?.emoji,
						);

					socket.nsp
						.to(
							`conversation:${reaction.conversationId}`,
						)
						.emit(
							"messageReactionAdded",
							reaction,
						);

					if (
						reaction.messageSenderId !== userId
					) {
						socket.nsp
							.to(
								`user:${reaction.messageSenderId}`,
							)
							.emit(
								"social:reaction",
								reaction,
							);
					}

					callback?.({
						success: true,
						reaction,
					});
				} catch (error) {
					callback?.({
						success: false,
						error:
							error instanceof Error
								? error.message
								: "Unable to add reaction",
					});
				}
			},
		);

		socket.on(
			"message:removeReaction",
			async (
				payload: RemoveReactionPayload,
				callback?: (
					response: ReactionResponse,
				) => void,
			) => {
				try {
					const removedReaction =
						await conversationService.removeMessageReaction(
							payload?.messageId,
							userId,
						);

					socket.nsp
						.to(
							`conversation:${removedReaction.conversationId}`,
						)
						.emit(
							"messageReactionRemoved",
							removedReaction,
						);

					callback?.({
						success: true,
						removedReaction,
					});
				} catch (error) {
					callback?.({
						success: false,
						error:
							error instanceof Error
								? error.message
								: "Unable to remove reaction",
					});
				}
			},
		);

		socket.on(
			"conversation:read",
			async (
				payload: MarkConversationReadPayload,
				callback?: (
					response: MarkConversationReadResponse,
				) => void,
			) => {
				try {
					await conversationService.markConversationRead(
						payload?.conversationId,
						userId,
						payload?.messageId,
					);

					const messageReadEvent: MessageReadEvent = {
						conversationId: payload.conversationId,
						userId,
						messageId: payload.messageId,
					};

					socket
						.to(
							`conversation:${payload.conversationId}`,
						)
						.emit(
							"messageRead",
							messageReadEvent,
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
								: "Unable to mark conversation as read",
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


		const leaveOnlineMatch = (): void => {
			if (waitingOnlineSocketId === socket.id) {
				waitingOnlineSocketId = null;
			}

			const roomId =
				onlineRoomBySocketId.get(socket.id);

			if (!roomId) {
				return;
			}

			onlineRoomBySocketId.delete(socket.id);
			onlineSideBySocketId.delete(socket.id);
			stopOnlineGame(roomId);

			const roomSockets =
				io?.sockets.adapter.rooms.get(
					`pong:${roomId}`,
				);

			if (roomSockets) {
				for (const socketId of roomSockets) {
					if (socketId === socket.id) {
						continue;
					}

					onlineRoomBySocketId.delete(socketId);
					onlineSideBySocketId.delete(socketId);

					io?.to(socketId).emit(
						"online:opponentLeft",
						{
							roomId,
						},
					);
				}
			}

			void socket.leave(`pong:${roomId}`);
		};

		socket.on(
			"online:joinQueue",
			async (
				callback?: (
					response: OnlineQueueResponse,
				) => void,
			) => {
				try {
					if (
						onlineRoomBySocketId.has(
							socket.id,
						)
					) {
						callback?.({
							success: true,
							status: "matched",
						});
						return;
					}

					if (
						waitingOnlineSocketId ===
						socket.id
					) {
						callback?.({
							success: true,
							status: "waiting",
						});
						return;
					}

					const waitingSocket =
						waitingOnlineSocketId
							? io?.sockets.sockets.get(
									waitingOnlineSocketId,
								)
							: undefined;

					if (!waitingSocket) {
						waitingOnlineSocketId =
							socket.id;

						callback?.({
							success: true,
							status: "waiting",
						});
						return;
					}

					const waitingRequest =
						waitingSocket.request as
							typeof waitingSocket.request &
							SessionRequest;

					const opponentUserId =
						waitingRequest.session.userId;

					if (
						opponentUserId === undefined ||
						opponentUserId === userId
					) {
						waitingOnlineSocketId =
							socket.id;

						callback?.({
							success: true,
							status: "waiting",
						});
						return;
					}

					waitingOnlineSocketId = null;

					const roomId = randomUUID();

					await waitingSocket.join(
						`pong:${roomId}`,
					);

					await socket.join(
						`pong:${roomId}`,
					);

					onlineRoomBySocketId.set(
						waitingSocket.id,
						roomId,
					);

					onlineRoomBySocketId.set(
						socket.id,
						roomId,
					);

					onlineSideBySocketId.set(
						waitingSocket.id,
						"left",
					);

					onlineSideBySocketId.set(
						socket.id,
						"right",
					);

					if (!io) {
						throw new Error(
							"Socket.IO server is unavailable",
						);
					}

					createOnlineGame(
						io,
						roomId,
					);

					const leftEvent:
						OnlineMatchFoundEvent = {
						roomId,
						side: "left",
						opponentUserId: userId,
					};

					const rightEvent:
						OnlineMatchFoundEvent = {
						roomId,
						side: "right",
						opponentUserId,
					};

					waitingSocket.emit(
						"online:matchFound",
						leftEvent,
					);

					socket.emit(
						"online:matchFound",
						rightEvent,
					);

					callback?.({
						success: true,
						status: "matched",
					});
				} catch (error) {
					callback?.({
						success: false,
						error:
							error instanceof Error
								? error.message
								: "Unable to join online queue",
					});
				}
			},
		);


		socket.on(
			"online:paddleMove",
			(payload: OnlinePaddleMovePayload) => {
				const roomId =
					onlineRoomBySocketId.get(socket.id);

				const side =
					onlineSideBySocketId.get(socket.id);

				if (!roomId || !side) {
					return;
				}

				const game = onlineGames.get(roomId);

				if (!game || game.winner) {
					return;
				}

				const y = Number(payload?.y);

				if (
					!Number.isFinite(y) ||
					y < 0 ||
					y >
						ONLINE_FIELD_HEIGHT -
						ONLINE_PADDLE_HEIGHT
				) {
					return;
				}

				if (side === "left") {
					game.leftPaddleY = y;
				} else {
					game.rightPaddleY = y;
				}
			},
		);

		socket.on(
			"online:leaveQueue",
			(
				callback?: (
					response: OnlineQueueResponse,
				) => void,
			) => {
				leaveOnlineMatch();

				callback?.({
					success: true,
					status: "idle",
				});
			},
		);

		socket.on("disconnect", () => {
			leaveOnlineMatch();
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
