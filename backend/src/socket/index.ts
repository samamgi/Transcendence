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

let io: Server | undefined;

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

		socket.on("disconnect", () => {
			console.log(
				`User ${userId} disconnected (${socket.id})`,
			);
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
