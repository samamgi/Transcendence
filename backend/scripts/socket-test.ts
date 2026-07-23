import { execFileSync } from "node:child_process";
import { io, type Socket } from "socket.io-client";

const API_URL = process.env.API_URL ?? "http://localhost:3000";
const DATABASE_CONTAINER =
	process.env.DATABASE_CONTAINER ?? "transcendence-database";

const TEST_USER = {
	username: "alice_socket",
	email: "alice.socket@example.com",
	password: "AliceTest123!",
};

type SocketMessage = {
	id: number;
	conversationId: number;
	senderId: number;
	content: string;
	createdAt: string;
	updatedAt: string;
	sender: {
		id: number;
		username: string;
		displayName: string | null;
		avatarUrl: string | null;
	};
};

type SocketResponse = {
	success: boolean;
	message?: SocketMessage;
	error?: string;
};

type TypingEvent = {
	conversationId: number;
	userId: number;
};

function waitForTypingEvent(
	socket: Socket,
	event: "typing:start" | "typing:stop",
): Promise<TypingEvent> {
	return new Promise((resolve, reject) => {
		const onTyping = (payload: TypingEvent): void => {
			clearTimeout(timeout);
			resolve(payload);
		};

		const timeout = setTimeout(() => {
			socket.off(event, onTyping);
			reject(
				new Error(
					`Aucun événement ${event} reçu dans les 5 secondes.`,
				),
			);
		}, 5000);

		socket.once(event, onTyping);
	});
}

function emitTypingEvent(
	socket: Socket,
	event: "typing:start" | "typing:stop",
	conversationId: number,
): Promise<SocketResponse> {
	return new Promise((resolve, reject) => {
		socket.timeout(5000).emit(
			event,
			{
				conversationId,
			},
			(
				error: Error | null,
				response: SocketResponse,
			) => {
				if (error) {
					reject(
						new Error(
							`Aucune réponse pour ${event}.`,
						),
					);
					return;
				}

				resolve(response);
			},
		);
	});
}

function runSql(sql: string): string {
	return execFileSync(
		"podman",
		[
			"exec",
			"-i",
			DATABASE_CONTAINER,
			"sh",
			"-lc",
			'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq',
		],
		{
			input: sql,
			encoding: "utf8",
		},
	).trim();
}

async function ensureTestUser(): Promise<void> {
	const response = await fetch(`${API_URL}/api/auth/register`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(TEST_USER),
	});

	if (response.ok) {
		console.log("Utilisateur de test créé.");
		return;
	}

	/*
	 * Une erreur 400/409 est normale si l'utilisateur existe déjà.
	 * Le login qui suit permettra de vérifier qu'il est utilisable.
	 */
	if (response.status === 400 || response.status === 409) {
		console.log("Utilisateur de test déjà présent.");
		return;
	}

	const body = await response.text();

	throw new Error(
		`Impossible de préparer l'utilisateur de test ` +
			`(${response.status}) : ${body}`,
	);
}

async function login(): Promise<string> {
	const response = await fetch(`${API_URL}/api/auth/login`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email: TEST_USER.email,
			password: TEST_USER.password,
		}),
	});

	if (!response.ok) {
		const body = await response.text();

		throw new Error(
			`Échec du login (${response.status}) : ${body}`,
		);
	}

	const setCookie = response.headers.get("set-cookie");

	if (!setCookie) {
		throw new Error(
			"Le serveur n'a renvoyé aucun cookie de session.",
		);
	}

	const sessionCookie = setCookie.match(
		/transcendence\.sid=[^;,\s]+/,
	)?.[0];

	if (!sessionCookie) {
		throw new Error(
			"Le cookie transcendence.sid est introuvable.",
		);
	}

	return sessionCookie;
}

async function getAuthenticatedUserId(
	cookie: string,
): Promise<number> {
	const response = await fetch(`${API_URL}/api/auth/me`, {
		headers: {
			Cookie: cookie,
		},
	});

	if (!response.ok) {
		const body = await response.text();

		throw new Error(
			`Impossible de lire l'utilisateur connecté ` +
				`(${response.status}) : ${body}`,
		);
	}

	const body = (await response.json()) as {
		user?: {
			id?: number;
		};
	};

	const userId = body.user?.id;

	if (!Number.isInteger(userId)) {
		throw new Error(
			"Identifiant utilisateur absent de /api/auth/me.",
		);
	}

	return userId as number;
}

function createTestConversation(userId: number): number {
	const result = runSql(`
WITH new_conversation AS (
	INSERT INTO "Conversation" ("createdAt", "updatedAt")
	VALUES (NOW(), NOW())
	RETURNING "id"
),
new_participant AS (
	INSERT INTO "ConversationParticipant"
		("conversationId", "userId", "joinedAt")
	SELECT "id", ${userId}, NOW()
	FROM new_conversation
)
SELECT "id"
FROM new_conversation;
`);

	const conversationId = Number.parseInt(result, 10);

	if (!Number.isInteger(conversationId)) {
		throw new Error(
			`ID de conversation invalide renvoyé par PostgreSQL : ${result}`,
		);
	}

	return conversationId;
}

function deleteTestConversation(conversationId: number): void {
	runSql(`
DELETE FROM "ConversationParticipant"
WHERE "conversationId" = ${conversationId};

DELETE FROM "Conversation"
WHERE "id" = ${conversationId};
`);
}

function emitWithAck(
	socket: Socket,
	event: string,
	conversationId: number,
): Promise<SocketResponse> {
	return new Promise((resolve, reject) => {
		socket.timeout(5000).emit(
			event,
			conversationId,
			(
				error: Error | null,
				response: SocketResponse,
			) => {
				if (error) {
					reject(
						new Error(
							`Aucune réponse pour ${event} ` +
								`avec la conversation ${conversationId}`,
						),
					);
					return;
				}

				resolve(response);
			},
		);
	});
}

function emitSendMessage(
	socket: Socket,
	conversationId: number,
	content: string,
): Promise<SocketResponse> {
	return new Promise((resolve, reject) => {
		socket.timeout(5000).emit(
			"sendMessage",
			{
				conversationId,
				content,
			},
			(
				error: Error | null,
				response: SocketResponse,
			) => {
				if (error) {
					reject(
						new Error(
							"Aucune réponse pour sendMessage " +
							`avec la conversation ${conversationId}`,
						),
					);
					return;
				}

				resolve(response);
			},
		);
	});
}

function waitForNewMessage(
	socket: Socket,
): Promise<SocketMessage> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			socket.off("newMessage", onMessage);
			reject(
				new Error(
					"Aucun événement newMessage reçu dans les 5 secondes.",
				),
			);
		}, 5000);

		function onMessage(message: SocketMessage): void {
			clearTimeout(timeout);
			resolve(message);
		}

		socket.once("newMessage", onMessage);
	});
}

async function connectSocket(cookie: string): Promise<Socket> {
	return new Promise((resolve, reject) => {
		const socket = io(API_URL, {
			extraHeaders: {
				Cookie: cookie,
			},
			reconnection: false,
			timeout: 5000,
		});

		socket.once("connect", () => {
			resolve(socket);
		});

		socket.once("connect_error", (error) => {
			socket.disconnect();
			reject(error);
		});
	});
}

async function main(): Promise<void> {
	let conversationId: number | null = null;
	let socket: Socket | null = null;
	let receiverSocket: Socket | null = null;

	try {
		await ensureTestUser();

		const cookie = await login();
		const userId = await getAuthenticatedUserId(cookie);

		console.log(
			`Utilisateur authentifié : ${TEST_USER.username} ` +
				`(id ${userId})`,
		);

		conversationId = createTestConversation(userId);

		console.log(
			`Conversation temporaire créée : ${conversationId}`,
		);

		socket = await connectSocket(cookie);

		console.log("Socket connecté :", socket.id);

		const allowedResponse = await emitWithAck(
			socket,
			"joinConversation",
			conversationId,
		);

		console.log(
			`Conversation ${conversationId} :`,
			allowedResponse,
		);

		if (!allowedResponse.success) {
			throw new Error(
				"La conversation autorisée a été refusée : " +
					(allowedResponse.error ?? "erreur inconnue"),
			);
		}

		receiverSocket = await connectSocket(cookie);

		console.log(
			"Second socket connecté :",
			receiverSocket.id,
		);

		const receiverJoinResponse = await emitWithAck(
			receiverSocket,
			"joinConversation",
			conversationId,
		);

		if (!receiverJoinResponse.success) {
			throw new Error(
				"Le second socket n'a pas pu rejoindre la conversation : " +
					(receiverJoinResponse.error ?? "erreur inconnue"),
			);
		}

		const receivedMessagePromise =
			waitForNewMessage(receiverSocket);

		const sentContent = "  Bonjour depuis Socket.IO  ";

		const sendResponse = await emitSendMessage(
			socket,
			conversationId,
			sentContent,
		);

		console.log(
			`Message envoyé dans la conversation ${conversationId} :`,
			sendResponse,
		);

		if (!sendResponse.success || !sendResponse.message) {
			throw new Error(
				"L'envoi du message autorisé a échoué : " +
					(sendResponse.error ?? "message absent"),
			);
		}

		if (
			sendResponse.message.conversationId !== conversationId
		) {
			throw new Error(
				"Le message a été associé à la mauvaise conversation.",
			);
		}

		if (sendResponse.message.senderId !== userId) {
			throw new Error(
				"Le message a été associé au mauvais expéditeur.",
			);
		}

		if (
			sendResponse.message.content !==
			"Bonjour depuis Socket.IO"
		) {
			throw new Error(
				"Le contenu du message n'a pas été correctement nettoyé.",
			);
		}

		const receivedMessage =
			await receivedMessagePromise;

		console.log(
			"Événement newMessage reçu par le second socket :",
			receivedMessage,
		);

		if (
			receivedMessage.id !== sendResponse.message.id ||
			receivedMessage.conversationId !== conversationId ||
			receivedMessage.senderId !== userId ||
			receivedMessage.content !==
				"Bonjour depuis Socket.IO"
		) {
			throw new Error(
				"L'événement newMessage ne correspond pas au message créé.",
			);
		}

		const typingStartPromise =
			waitForTypingEvent(
				receiverSocket,
				"typing:start",
			);

		const typingStartResponse =
			await emitTypingEvent(
				socket,
				"typing:start",
				conversationId,
			);

		console.log(
			"Réponse typing:start :",
			typingStartResponse,
		);

		if (!typingStartResponse.success) {
			throw new Error(
				"typing:start a été refusé : " +
					(typingStartResponse.error ??
						"erreur inconnue"),
			);
		}

		const typingStartEvent =
			await typingStartPromise;

		console.log(
			"Événement typing:start reçu :",
			typingStartEvent,
		);

		if (
			typingStartEvent.conversationId !==
				conversationId ||
			typingStartEvent.userId !== userId
		) {
			throw new Error(
				"Le contenu de typing:start est invalide.",
			);
		}

		const typingStopPromise =
			waitForTypingEvent(
				receiverSocket,
				"typing:stop",
			);

		const typingStopResponse =
			await emitTypingEvent(
				socket,
				"typing:stop",
				conversationId,
			);

		console.log(
			"Réponse typing:stop :",
			typingStopResponse,
		);

		if (!typingStopResponse.success) {
			throw new Error(
				"typing:stop a été refusé : " +
					(typingStopResponse.error ??
						"erreur inconnue"),
			);
		}

		const typingStopEvent =
			await typingStopPromise;

		console.log(
			"Événement typing:stop reçu :",
			typingStopEvent,
		);

		if (
			typingStopEvent.conversationId !==
				conversationId ||
			typingStopEvent.userId !== userId
		) {
			throw new Error(
				"Le contenu de typing:stop est invalide.",
			);
		}

		const leaveResponse = await emitWithAck(
			socket,
			"leaveConversation",
			conversationId,
		);

		console.log(
			`Quitter la conversation ${conversationId} :`,
			leaveResponse,
		);

		if (!leaveResponse.success) {
			throw new Error(
				"Impossible de quitter la conversation autorisée : " +
					(leaveResponse.error ?? "erreur inconnue"),
			);
		}

		const forbiddenConversationId = 2_147_483_647;

		const forbiddenResponse = await emitWithAck(
			socket,
			"joinConversation",
			forbiddenConversationId,
		);

		console.log(
			`Conversation inexistante ${forbiddenConversationId} :`,
			forbiddenResponse,
		);

		if (forbiddenResponse.success) {
			throw new Error(
				"Une conversation non autorisée a été acceptée.",
			);
		}

		const forbiddenTypingResponse =
			await emitTypingEvent(
				socket,
				"typing:start",
				forbiddenConversationId,
			);

		console.log(
			`Typing interdit dans ${forbiddenConversationId} :`,
			forbiddenTypingResponse,
		);

		if (forbiddenTypingResponse.success) {
			throw new Error(
				"typing:start a été accepté dans une conversation non autorisée.",
			);
		}

		const forbiddenSendResponse = await emitSendMessage(
			socket,
			forbiddenConversationId,
			"Message interdit",
		);

		console.log(
			`Message interdit dans ${forbiddenConversationId} :`,
			forbiddenSendResponse,
		);

		if (forbiddenSendResponse.success) {
			throw new Error(
				"Un message a été envoyé dans une conversation non autorisée.",
			);
		}

		console.log("Test Socket.IO réussi.");
	} finally {
		if (receiverSocket) {
			receiverSocket.disconnect();
		}

		if (socket) {
			socket.disconnect();
		}

		if (conversationId !== null) {
			deleteTestConversation(conversationId);

			console.log(
				`Conversation temporaire ${conversationId} supprimée.`,
			);
		}
	}
}

main().catch((error: unknown) => {
	if (error instanceof Error) {
		console.error("Échec du test Socket.IO :", error.message);
	} else {
		console.error("Échec du test Socket.IO :", error);
	}

	process.exit(1);
});
