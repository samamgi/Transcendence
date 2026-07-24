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

const PRESENCE_TEST_USER = {
	username: "bob_socket_presence",
	email: "bob.socket.presence@example.com",
	password: "BobTest123!",
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

type GetMessagesResponse = {
	success: boolean;
	messages?: SocketMessage[];
	error?: string;
};

type TypingEvent = {
	conversationId: number;
	userId: number;
};


type ConversationDeletedEvent = {
	conversationId: number;
};


type MessageUpdatedEvent = {
	id: number;
	conversationId: number;
	senderId: number;
	content: string;
	createdAt: string;
	updatedAt: string;
};

function waitForMessageUpdated(
	socket: Socket,
): Promise<MessageUpdatedEvent> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			socket.off(
				"messageUpdated",
				onMessageUpdated,
			);
			reject(
				new Error(
					"Aucun événement messageUpdated reçu dans les 5 secondes.",
				),
			);
		}, 5000);

		function onMessageUpdated(
			payload: MessageUpdatedEvent,
		): void {
			clearTimeout(timeout);
			resolve(payload);
		}

		socket.once(
			"messageUpdated",
			onMessageUpdated,
		);
	});
}

async function updateMessageHttp(
	cookie: string,
	messageId: number,
	content: string,
): Promise<Response> {
	return fetch(
		`${API_URL}/api/conversations/messages/${messageId}`,
		{
			method: "PATCH",
			headers: {
				Cookie: cookie,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				content,
			}),
		},
	);
}

function waitForConversationDeleted(
	socket: Socket,
): Promise<ConversationDeletedEvent> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			socket.off(
				"conversationDeleted",
				onConversationDeleted,
			);
			reject(
				new Error(
					"Aucun événement conversationDeleted reçu dans les 5 secondes.",
				),
			);
		}, 5000);

		function onConversationDeleted(
			payload: ConversationDeletedEvent,
		): void {
			clearTimeout(timeout);
			resolve(payload);
		}

		socket.once(
			"conversationDeleted",
			onConversationDeleted,
		);
	});
}

async function deleteConversationHttp(
	cookie: string,
	conversationId: number,
): Promise<Response> {
	return fetch(
		`${API_URL}/api/conversations/${conversationId}`,
		{
			method: "DELETE",
			headers: {
				Cookie: cookie,
			},
		},
	);
}

type MessageReadEvent = {
	conversationId: number;
	userId: number;
	messageId: number;
};

type MarkConversationReadResponse = {
	success: boolean;
	error?: string;
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

async function ensureTestUser(
	user = TEST_USER,
): Promise<void> {
	const response = await fetch(`${API_URL}/api/auth/register`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(user),
	});

	if (response.ok) {
		console.log(
			`Utilisateur de test ${user.username} créé.`,
		);
		return;
	}

	/*
	 * Une erreur 400/409 est normale si l'utilisateur existe déjà.
	 * Le login qui suit permettra de vérifier qu'il est utilisable.
	 */
	if (response.status === 400 || response.status === 409) {
		console.log(
			`Utilisateur de test ${user.username} déjà présent.`,
		);
		return;
	}

	const body = await response.text();

	throw new Error(
		`Impossible de préparer l'utilisateur de test ` +
			`${user.username} (${response.status}) : ${body}`,
	);
}

async function login(
	user = TEST_USER,
): Promise<string> {
	const response = await fetch(`${API_URL}/api/auth/login`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email: user.email,
			password: user.password,
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

function createTestConversation(
	userId: number,
	otherUserId: number,
): number {
	const result = runSql(`
WITH new_conversation AS (
	INSERT INTO "Conversation" ("createdAt", "updatedAt")
	VALUES (NOW(), NOW())
	RETURNING "id"
),
new_participants AS (
	INSERT INTO "ConversationParticipant"
		("conversationId", "userId", "joinedAt")
	SELECT "id", ${userId}, NOW()
	FROM new_conversation
	UNION ALL
	SELECT "id", ${otherUserId}, NOW()
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


function emitGetMessages(
	socket: Socket,
	conversationId: number,
	limit = 50,
	before?: number,
): Promise<GetMessagesResponse> {
	return new Promise((resolve, reject) => {
		socket.timeout(5000).emit(
			"getMessages",
			{
				conversationId,
				limit,
				before,
			},
			(
				error: Error | null,
				response: GetMessagesResponse,
			) => {
				if (error) {
					reject(
						new Error("Aucune réponse pour getMessages."),
					);
					return;
				}

				resolve(response);
			},
		);
	});
}


function emitConversationRead(
	socket: Socket,
	conversationId: number,
	messageId: number,
): Promise<MarkConversationReadResponse> {
	return new Promise((resolve, reject) => {
		socket.timeout(5000).emit(
			"conversation:read",
			{
				conversationId,
				messageId,
			},
			(
				error: Error | null,
				response: MarkConversationReadResponse,
			) => {
				if (error) {
					reject(
						new Error(
							"Aucune réponse pour conversation:read.",
						),
					);
					return;
				}

				resolve(response);
			},
		);
	});
}

function waitForMessageRead(
	socket: Socket,
): Promise<MessageReadEvent> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			socket.off("messageRead", onRead);
			reject(
				new Error(
					"Aucun événement messageRead reçu dans les 5 secondes.",
				),
			);
		}, 5000);

		function onRead(payload: MessageReadEvent): void {
			clearTimeout(timeout);
			resolve(payload);
		}

		socket.once("messageRead", onRead);
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

type PresenceEvent = {
	userId: number;
};

function waitForPresenceEvent(
	socket: Socket,
	event: "userOnline" | "userOffline",
): Promise<PresenceEvent> {
	return new Promise((resolve, reject) => {
		const onPresence = (payload: PresenceEvent): void => {
			clearTimeout(timeout);
			resolve(payload);
		};

		const timeout = setTimeout(() => {
			socket.off(event, onPresence);
			reject(
				new Error(
					`Aucun événement ${event} reçu dans les 5 secondes.`,
				),
			);
		}, 5000);

		socket.once(event, onPresence);
	});
}

function expectNoPresenceEvent(
	socket: Socket,
	event: "userOnline" | "userOffline",
	duration = 500,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const onPresence = (payload: PresenceEvent): void => {
			clearTimeout(timeout);
			reject(
				new Error(
					`${event} reçu de manière inattendue pour ` +
						`l'utilisateur ${payload.userId}.`,
				),
			);
		};

		const timeout = setTimeout(() => {
			socket.off(event, onPresence);
			resolve();
		}, duration);

		socket.once(event, onPresence);
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
	let presenceSocket1: Socket | null = null;
	let presenceSocket2: Socket | null = null;

	try {
		await ensureTestUser();
		await ensureTestUser(PRESENCE_TEST_USER);

		const cookie = await login();
		const userId = await getAuthenticatedUserId(cookie);

		const presenceCookie =
			await login(PRESENCE_TEST_USER);

		const presenceUserId =
			await getAuthenticatedUserId(presenceCookie);

		console.log(
			`Utilisateur authentifié : ${TEST_USER.username} ` +
				`(id ${userId})`,
		);

		conversationId = createTestConversation(userId, presenceUserId);

		console.log(
			`Conversation temporaire créée : ${conversationId}`,
		);

		socket = await connectSocket(cookie);

		console.log("Socket connecté :", socket.id);

		const onlinePromise =
			waitForPresenceEvent(socket, "userOnline");

		presenceSocket1 =
			await connectSocket(presenceCookie);

		const onlineEvent = await onlinePromise;

		console.log(
			"Événement userOnline reçu :",
			onlineEvent,
		);

		if (onlineEvent.userId !== presenceUserId) {
			throw new Error(
				"userOnline contient un identifiant invalide.",
			);
		}

		const noSecondOnlinePromise =
			expectNoPresenceEvent(
				socket,
				"userOnline",
			);

		presenceSocket2 =
			await connectSocket(presenceCookie);

		await noSecondOnlinePromise;

		console.log(
			"Aucun userOnline émis pour le second socket.",
		);

		const noEarlyOfflinePromise =
			expectNoPresenceEvent(
				socket,
				"userOffline",
			);

		presenceSocket1.disconnect();
		presenceSocket1 = null;

		await noEarlyOfflinePromise;

		console.log(
			"Aucun userOffline émis tant qu'un socket reste connecté.",
		);

		const offlinePromise =
			waitForPresenceEvent(socket, "userOffline");

		presenceSocket2.disconnect();
		presenceSocket2 = null;

		const offlineEvent = await offlinePromise;

		console.log(
			"Événement userOffline reçu :",
			offlineEvent,
		);

		if (offlineEvent.userId !== presenceUserId) {
			throw new Error(
				"userOffline contient un identifiant invalide.",
			);
		}

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

		receiverSocket = await connectSocket(
			presenceCookie,
		);

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

		const historyResponse = await emitGetMessages(
			socket,
			conversationId,
		);

		console.log(
			"Historique des messages :",
			historyResponse,
		);

		if (
			!historyResponse.success ||
			!historyResponse.messages
		) {
			throw new Error(
				"Impossible de récupérer l'historique.",
			);
		}

		const foundMessage =
			historyResponse.messages.find(
				(message) =>
					message.id === sendResponse.message!.id,
			);

		if (!foundMessage) {
			throw new Error(
				"Le message envoyé est absent de l'historique.",
			);
		}

		const messageReadPromise =
			waitForMessageRead(socket);

		const readResponse =
			await emitConversationRead(
				receiverSocket,
				conversationId,
				sendResponse.message.id,
			);

		console.log(
			"Réponse conversation:read :",
			readResponse,
		);

		if (!readResponse.success) {
			throw new Error(
				"conversation:read a été refusé : " +
					(readResponse.error ??
						"erreur inconnue"),
			);
		}

		const messageReadEvent =
			await messageReadPromise;

		console.log(
			"Événement messageRead reçu :",
			messageReadEvent,
		);

		if (
			messageReadEvent.conversationId !==
				conversationId ||
			messageReadEvent.userId !==
				presenceUserId ||
			messageReadEvent.messageId !==
				sendResponse.message.id
		) {
			throw new Error(
				"Le contenu de l'événement messageRead est invalide.",
			);
		}

		const messageUpdatedPromise =
			waitForMessageUpdated(
				receiverSocket,
			);

		const updateResponse =
			await updateMessageHttp(
				cookie,
				sendResponse.message.id,
				"Message modifié",
			);

		if (!updateResponse.ok) {
			throw new Error(
				`PATCH /messages a échoué (${updateResponse.status})`,
			);
		}

		const updatedMessage =
			await messageUpdatedPromise;

		console.log(
			"Événement messageUpdated reçu :",
			updatedMessage,
		);

		if (
			updatedMessage.id !==
				sendResponse.message.id ||
			updatedMessage.content !==
				"Message modifié"
		) {
			throw new Error(
				"Le contenu de messageUpdated est invalide.",
			);
		}

		const forbiddenUpdateResponse =
			await updateMessageHttp(
				presenceCookie,
				sendResponse.message.id,
				"Modification interdite",
			);

		console.log(
			"Modification interdite par un autre utilisateur :",
			forbiddenUpdateResponse.status,
		);

		if (forbiddenUpdateResponse.status !== 403) {
			throw new Error(
				`La modification par un autre utilisateur devait retourner 403, reçu ${forbiddenUpdateResponse.status}.`,
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


		const deletedPromiseAlice =
			waitForConversationDeleted(socket);

		const deletedPromiseBob =
			waitForConversationDeleted(receiverSocket);

		const deleteResponse =
			await deleteConversationHttp(
				cookie,
				conversationId,
			);

		if (!deleteResponse.ok) {
			throw new Error(
				`DELETE /conversations a échoué (${deleteResponse.status})`,
			);
		}

		const deletedAlice =
			await deletedPromiseAlice;

		const deletedBob =
			await deletedPromiseBob;

		console.log(
			"Événement conversationDeleted reçu :",
			deletedAlice,
			deletedBob,
		);

		if (
			deletedAlice.conversationId !==
				conversationId ||
			deletedBob.conversationId !==
				conversationId
		) {
			throw new Error(
				"conversationDeleted contient un mauvais identifiant.",
			);
		}

		console.log("Test Socket.IO réussi.");
	} finally {
		if (presenceSocket2) {
			presenceSocket2.disconnect();
		}

		if (presenceSocket1) {
			presenceSocket1.disconnect();
		}

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
