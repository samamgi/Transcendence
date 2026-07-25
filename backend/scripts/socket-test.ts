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

const GROUP_TEST_USER = {
	username: "charlie_socket_group",
	email: "charlie.socket.group@example.com",
	password: "CharlieTest123!",
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

type GroupConversation = {
	id: number;
	type?: string;
	name?: string | null;
	ownerId?: number | null;
	participants?: Array<{
		userId?: number;
		user?: {
			id: number;
			username?: string;
		};
	}>;
};

type GroupConversationResponse = {
	success?: boolean;
	conversation?: GroupConversation;
	error?: string;
};

type LeaveGroupConversationResponse = {
	success?: boolean;
	message?: string;
	deleted?: boolean;
	conversation?: GroupConversation | null;
	error?: string;
};

type ConversationCreatedEvent = GroupConversation;

type ConversationUpdatedEvent = GroupConversation;


type MessageUpdatedEvent = {
	id: number;
	conversationId: number;
	senderId: number;
	content: string;
	createdAt: string;
	updatedAt: string;
};


type MessageDeletedEvent = {
	id: number;
	conversationId: number;
};

type MessageReaction = {
	messageId: number;
	conversationId: number;
	userId: number;
	emoji: string;
	user: {
		id: number;
		username: string;
		displayName: string | null;
		avatarUrl: string | null;
	};
};

type RemovedReaction = {
	messageId: number;
	conversationId: number;
	userId: number;
};

function waitForConversationCreated(
	socket: Socket,
): Promise<ConversationCreatedEvent> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			socket.off(
				"conversationCreated",
				onConversationCreated,
			);
			reject(
				new Error(
					"Aucun événement conversationCreated reçu dans les 5 secondes.",
				),
			);
		}, 5000);

		function onConversationCreated(
			payload: ConversationCreatedEvent,
		): void {
			clearTimeout(timeout);
			resolve(payload);
		}

		socket.once(
			"conversationCreated",
			onConversationCreated,
		);
	});
}

function waitForConversationUpdated(
	socket: Socket,
): Promise<ConversationUpdatedEvent> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			socket.off(
				"conversationUpdated",
				onConversationUpdated,
			);
			reject(
				new Error(
					"Aucun événement conversationUpdated reçu dans les 5 secondes.",
				),
			);
		}, 5000);

		function onConversationUpdated(
			payload: ConversationUpdatedEvent,
		): void {
			clearTimeout(timeout);
			resolve(payload);
		}

		socket.once(
			"conversationUpdated",
			onConversationUpdated,
		);
	});
}

async function createGroupConversationHttp(
	cookie: string,
	name: string,
	memberIds: number[],
): Promise<Response> {
	return fetch(
		`${API_URL}/api/conversations/groups`,
		{
			method: "POST",
			headers: {
				Cookie: cookie,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name,
				memberIds,
			}),
		},
	);
}

async function renameGroupConversationHttp(
	cookie: string,
	conversationId: number,
	name: string,
): Promise<Response> {
	return fetch(
		`${API_URL}/api/conversations/groups/${conversationId}/name`,
		{
			method: "PATCH",
			headers: {
				Cookie: cookie,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name,
			}),
		},
	);
}

async function addGroupMemberHttp(
	cookie: string,
	conversationId: number,
	memberId: number,
): Promise<Response> {
	return fetch(
		`${API_URL}/api/conversations/groups/${conversationId}/members`,
		{
			method: "POST",
			headers: {
				Cookie: cookie,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				memberId,
			}),
		},
	);
}

async function removeGroupMemberHttp(
	cookie: string,
	conversationId: number,
	memberId: number,
): Promise<Response> {
	return fetch(
		`${API_URL}/api/conversations/groups/${conversationId}/members/${memberId}`,
		{
			method: "DELETE",
			headers: {
				Cookie: cookie,
			},
		},
	);
}

async function leaveGroupConversationHttp(
	cookie: string,
	conversationId: number,
): Promise<Response> {
	return fetch(
		`${API_URL}/api/conversations/groups/${conversationId}/leave`,
		{
			method: "DELETE",
			headers: {
				Cookie: cookie,
			},
		},
	);
}

function waitForMessageReactionAdded(
	socket: Socket,
): Promise<MessageReaction> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			socket.off(
				"messageReactionAdded",
				onReaction,
			);
			reject(
				new Error(
					"Aucun événement messageReactionAdded reçu dans les 5 secondes.",
				),
			);
		}, 5000);

		function onReaction(
			payload: MessageReaction,
		): void {
			clearTimeout(timeout);
			resolve(payload);
		}

		socket.once(
			"messageReactionAdded",
			onReaction,
		);
	});
}

function waitForMessageReactionRemoved(
	socket: Socket,
): Promise<RemovedReaction> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			socket.off(
				"messageReactionRemoved",
				onReaction,
			);
			reject(
				new Error(
					"Aucun événement messageReactionRemoved reçu dans les 5 secondes.",
				),
			);
		}, 5000);

		function onReaction(
			payload: RemovedReaction,
		): void {
			clearTimeout(timeout);
			resolve(payload);
		}

		socket.once(
			"messageReactionRemoved",
			onReaction,
		);
	});
}

function waitForMessageDeleted(
	socket: Socket,
): Promise<MessageDeletedEvent> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			socket.off(
				"messageDeleted",
				onMessageDeleted,
			);
			reject(
				new Error(
					"Aucun événement messageDeleted reçu dans les 5 secondes.",
				),
			);
		}, 5000);

		function onMessageDeleted(
			payload: MessageDeletedEvent,
		): void {
			clearTimeout(timeout);
			resolve(payload);
		}

		socket.once(
			"messageDeleted",
			onMessageDeleted,
		);
	});
}

async function deleteMessageHttp(
	cookie: string,
	messageId: number,
): Promise<Response> {
	return fetch(
		`${API_URL}/api/conversations/messages/${messageId}`,
		{
			method: "DELETE",
			headers: {
				Cookie: cookie,
			},
		},
	);
}

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
	let groupConversationId: number | null = null;
	let ownerLeaveGroupId: number | null = null;
	let lastMemberGroupId: number | null = null;
	let socket: Socket | null = null;
	let receiverSocket: Socket | null = null;
	let groupMemberSocket: Socket | null = null;
	let presenceSocket1: Socket | null = null;
	let presenceSocket2: Socket | null = null;

	try {
		await ensureTestUser();
		await ensureTestUser(PRESENCE_TEST_USER);
		await ensureTestUser(GROUP_TEST_USER);

		const cookie = await login();
		const userId = await getAuthenticatedUserId(cookie);

		const presenceCookie =
			await login(PRESENCE_TEST_USER);

		const presenceUserId =
			await getAuthenticatedUserId(presenceCookie);

		const groupMemberCookie =
			await login(GROUP_TEST_USER);

		const groupMemberUserId =
			await getAuthenticatedUserId(groupMemberCookie);

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

		groupMemberSocket = await connectSocket(
			groupMemberCookie,
		);

		console.log(
			"Socket du troisième utilisateur connecté :",
			groupMemberSocket.id,
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

		/*
		 * Conversations de groupe :
		 * création, renommage et contrôle du propriétaire.
		 */
		const groupCreatedForOwnerPromise =
			waitForConversationCreated(socket);

		const groupCreatedForMemberPromise =
			waitForConversationCreated(receiverSocket);

		const initialGroupName =
			"Groupe Socket.IO initial";

		const createGroupResponse =
			await createGroupConversationHttp(
				cookie,
				initialGroupName,
				[presenceUserId],
			);

		const createGroupBody =
			(await createGroupResponse.json()) as
				GroupConversationResponse;

		if (
			!createGroupResponse.ok ||
			!createGroupBody.conversation
		) {
			throw new Error(
				`La création du groupe a échoué ` +
				`(${createGroupResponse.status}) : ` +
				(createGroupBody.error ??
					JSON.stringify(createGroupBody)),
			);
		}

		groupConversationId =
			createGroupBody.conversation.id;

		if (!Number.isInteger(groupConversationId)) {
			throw new Error(
				"La création du groupe n'a renvoyé aucun identifiant valide.",
			);
		}

		const groupCreatedForOwner =
			await groupCreatedForOwnerPromise;

		const groupCreatedForMember =
			await groupCreatedForMemberPromise;

		console.log(
			"Groupe créé :",
			createGroupBody.conversation,
		);

		if (
			groupCreatedForOwner.id !==
				groupConversationId ||
			groupCreatedForMember.id !==
				groupConversationId
		) {
			throw new Error(
				"conversationCreated contient un mauvais identifiant de groupe.",
			);
		}

		if (
			createGroupBody.conversation.name !==
			initialGroupName
		) {
			throw new Error(
				"Le nom initial du groupe est incorrect.",
			);
		}

		if (
			createGroupBody.conversation.type &&
			createGroupBody.conversation.type !== "GROUP"
		) {
			throw new Error(
				"La conversation créée n'est pas de type GROUP.",
			);
		}

		if (
			createGroupBody.conversation.ownerId !==
			undefined &&
			createGroupBody.conversation.ownerId !==
			userId
		) {
			throw new Error(
				"Le propriétaire du groupe est incorrect.",
			);
		}

		const renamedGroupName =
			"Groupe Socket.IO renommé";

		const groupUpdatedForOwnerPromise =
			waitForConversationUpdated(socket);

		const groupUpdatedForMemberPromise =
			waitForConversationUpdated(receiverSocket);

		const renameGroupResponse =
			await renameGroupConversationHttp(
				cookie,
				groupConversationId,
				renamedGroupName,
			);

		const renameGroupBody =
			(await renameGroupResponse.json()) as
				GroupConversationResponse;

		if (
			!renameGroupResponse.ok ||
			!renameGroupBody.conversation
		) {
			throw new Error(
				`Le renommage du groupe a échoué ` +
				`(${renameGroupResponse.status}) : ` +
				(renameGroupBody.error ??
					JSON.stringify(renameGroupBody)),
			);
		}

		const groupUpdatedForOwner =
			await groupUpdatedForOwnerPromise;

		const groupUpdatedForMember =
			await groupUpdatedForMemberPromise;

		console.log(
			"Groupe renommé :",
			renameGroupBody.conversation,
		);

		if (
			renameGroupBody.conversation.name !==
				renamedGroupName ||
			groupUpdatedForOwner.name !==
				renamedGroupName ||
			groupUpdatedForMember.name !==
				renamedGroupName
		) {
			throw new Error(
				"Le nouveau nom du groupe n'a pas été propagé correctement.",
			);
		}

		if (
			groupUpdatedForOwner.id !==
				groupConversationId ||
			groupUpdatedForMember.id !==
				groupConversationId
		) {
			throw new Error(
				"conversationUpdated contient un mauvais identifiant.",
			);
		}

		const forbiddenRenameResponse =
			await renameGroupConversationHttp(
				presenceCookie,
				groupConversationId,
				"Renommage interdit",
			);

		console.log(
			"Renommage par un non-propriétaire :",
			forbiddenRenameResponse.status,
		);

		if (forbiddenRenameResponse.ok) {
			throw new Error(
				"Un membre non propriétaire a pu renommer le groupe.",
			);
		}

		const storedGroupName = runSql(`
SELECT "name"
FROM "Conversation"
WHERE "id" = ${groupConversationId};
`);

		if (storedGroupName !== renamedGroupName) {
			throw new Error(
				"Le renommage interdit a modifié le groupe en base de données.",
			);
		}

		console.log(
			"Tests de création et de renommage de groupe réussis.",
		);

		/*
		 * Ajout d'un troisième membre.
		 */
		const memberAddedForOwnerPromise =
			waitForConversationUpdated(socket);

		const memberAddedForExistingMemberPromise =
			waitForConversationUpdated(receiverSocket);

		const memberAddedForNewMemberPromise =
			waitForConversationCreated(groupMemberSocket);

		const addMemberResponse =
			await addGroupMemberHttp(
				cookie,
				groupConversationId,
				groupMemberUserId,
			);

		const addMemberBody =
			(await addMemberResponse.json()) as
				GroupConversationResponse;

		if (
			!addMemberResponse.ok ||
			!addMemberBody.conversation
		) {
			throw new Error(
				`L'ajout du membre a échoué ` +
				`(${addMemberResponse.status}) : ` +
				(addMemberBody.error ??
					JSON.stringify(addMemberBody)),
			);
		}

		const memberAddedForOwner =
			await memberAddedForOwnerPromise;

		const memberAddedForExistingMember =
			await memberAddedForExistingMemberPromise;

		const memberAddedForNewMember =
			await memberAddedForNewMemberPromise;

		if (
			memberAddedForOwner.id !== groupConversationId ||
			memberAddedForExistingMember.id !==
				groupConversationId
		) {
			throw new Error(
				"conversationUpdated contient un mauvais groupe après l'ajout.",
			);
		}

		if (
			memberAddedForNewMember.id !==
				groupConversationId
		) {
			throw new Error(
				"conversationCreated contient un mauvais groupe pour le nouveau membre.",
			);
		}

		const addedMemberCount = Number.parseInt(
			runSql(`
SELECT COUNT(*)
FROM "ConversationParticipant"
WHERE "conversationId" = ${groupConversationId}
AND "userId" = ${groupMemberUserId};
`),
			10,
		);

		if (addedMemberCount !== 1) {
			throw new Error(
				"Le troisième membre n'a pas été ajouté correctement en base.",
			);
		}

		console.log(
			"Troisième membre ajouté au groupe :",
			groupMemberUserId,
		);

		/*
		 * Un même membre ne doit pas pouvoir être ajouté deux fois.
		 */
		const duplicateMemberResponse =
			await addGroupMemberHttp(
				cookie,
				groupConversationId,
				groupMemberUserId,
			);

		console.log(
			"Ajout d'un membre déjà présent :",
			duplicateMemberResponse.status,
		);

		if (duplicateMemberResponse.ok) {
			throw new Error(
				"Un membre déjà présent a pu être ajouté une seconde fois.",
			);
		}

		/*
		 * Un membre non propriétaire ne peut pas ajouter quelqu'un.
		 */
		const forbiddenAddResponse =
			await addGroupMemberHttp(
				presenceCookie,
				groupConversationId,
				groupMemberUserId,
			);

		console.log(
			"Ajout par un non-propriétaire :",
			forbiddenAddResponse.status,
		);

		if (forbiddenAddResponse.ok) {
			throw new Error(
				"Un membre non propriétaire a pu ajouter un membre.",
			);
		}

		/*
		 * Retrait du troisième membre.
		 */
		const memberRemovedForOwnerPromise =
			waitForConversationUpdated(socket);

		const memberRemovedForRemainingMemberPromise =
			waitForConversationUpdated(receiverSocket);

		const removedMemberDeletedPromise =
			waitForConversationDeleted(groupMemberSocket);

		const removeMemberResponse =
			await removeGroupMemberHttp(
				cookie,
				groupConversationId,
				groupMemberUserId,
			);

		const removeMemberBody =
			(await removeMemberResponse.json()) as
				GroupConversationResponse;

		if (!removeMemberResponse.ok) {
			throw new Error(
				`Le retrait du membre a échoué ` +
				`(${removeMemberResponse.status}) : ` +
				(removeMemberBody.error ??
					JSON.stringify(removeMemberBody)),
			);
		}

		const memberRemovedForOwner =
			await memberRemovedForOwnerPromise;

		const memberRemovedForRemainingMember =
			await memberRemovedForRemainingMemberPromise;

		const removedMemberDeleted =
			await removedMemberDeletedPromise;

		if (
			memberRemovedForOwner.id !== groupConversationId ||
			memberRemovedForRemainingMember.id !==
				groupConversationId ||
			removedMemberDeleted.conversationId !==
				groupConversationId
		) {
			throw new Error(
				"Les événements de retrait contiennent un mauvais identifiant.",
			);
		}

		const removedMemberCount = Number.parseInt(
			runSql(`
SELECT COUNT(*)
FROM "ConversationParticipant"
WHERE "conversationId" = ${groupConversationId}
AND "userId" = ${groupMemberUserId};
`),
			10,
		);

		if (removedMemberCount !== 0) {
			throw new Error(
				"Le membre retiré est encore présent en base.",
			);
		}

		const forbiddenJoinAfterRemoval =
			await emitWithAck(
				groupMemberSocket,
				"joinConversation",
				groupConversationId,
			);

		if (forbiddenJoinAfterRemoval.success) {
			throw new Error(
				"Le membre retiré peut encore rejoindre le groupe.",
			);
		}

		console.log(
			"Tests d'ajout et de retrait d'un membre réussis.",
		);

		/*
		 * Un membre non propriétaire quitte volontairement
		 * le groupe.
		 */
		const memberLeaveDeletedPromise =
			waitForConversationDeleted(receiverSocket);

		const memberLeaveUpdatedPromise =
			waitForConversationUpdated(socket);

		const memberLeaveResponse =
			await leaveGroupConversationHttp(
				presenceCookie,
				groupConversationId,
			);

		const memberLeaveBody =
			(await memberLeaveResponse.json()) as
				LeaveGroupConversationResponse;

		console.log(
			"Sortie volontaire du membre :",
			memberLeaveResponse.status,
			memberLeaveBody,
		);

		if (
			!memberLeaveResponse.ok ||
			memberLeaveBody.deleted !== false ||
			!memberLeaveBody.conversation
		) {
			throw new Error(
				`La sortie volontaire du membre a échoué ` +
				`(${memberLeaveResponse.status}) : ` +
				(memberLeaveBody.error ??
					JSON.stringify(memberLeaveBody)),
			);
		}

		const memberLeaveDeleted =
			await memberLeaveDeletedPromise;

		const memberLeaveUpdated =
			await memberLeaveUpdatedPromise;

		if (
			memberLeaveDeleted.conversationId !==
				groupConversationId
		) {
			throw new Error(
				"conversationDeleted contient un mauvais identifiant après la sortie du membre.",
			);
		}

		if (
			memberLeaveUpdated.id !==
				groupConversationId
		) {
			throw new Error(
				"conversationUpdated contient un mauvais groupe après la sortie du membre.",
			);
		}

		if (
			memberLeaveBody.conversation.participants?.some(
				(participant) =>
					participant.userId === presenceUserId,
			) ||
			memberLeaveUpdated.participants?.some(
				(participant) =>
					participant.userId === presenceUserId,
			)
		) {
			throw new Error(
				"Le membre ayant quitté le groupe figure encore parmi les participants.",
			);
		}

		const memberAfterLeaveCount =
			Number.parseInt(
				runSql(`
SELECT COUNT(*)
FROM "ConversationParticipant"
WHERE "conversationId" = ${groupConversationId}
AND "userId" = ${presenceUserId};
`),
				10,
			);

		if (memberAfterLeaveCount !== 0) {
			throw new Error(
				"Le membre ayant quitté le groupe est encore présent en base.",
			);
		}

		const secondLeaveResponse =
			await leaveGroupConversationHttp(
				presenceCookie,
				groupConversationId,
			);

		const secondLeaveBody =
			(await secondLeaveResponse.json()) as
				LeaveGroupConversationResponse;

		console.log(
			"Seconde tentative de sortie :",
			secondLeaveResponse.status,
			secondLeaveBody,
		);

		if (
			secondLeaveResponse.status !== 403 ||
			secondLeaveResponse.ok
		) {
			throw new Error(
				"Un utilisateur qui n'est plus membre a pu quitter le groupe une seconde fois.",
			);
		}

		console.log(
			"Test de sortie volontaire d'un membre réussi.",
		);

		/*
		 * Le propriétaire quitte un groupe contenant encore
		 * deux membres. La propriété doit être transférée.
		 */
		const ownerGroupCreatedForAlicePromise =
			waitForConversationCreated(socket);

		const ownerGroupCreatedForBobPromise =
			waitForConversationCreated(receiverSocket);

		const ownerGroupCreatedForCharliePromise =
			waitForConversationCreated(groupMemberSocket);

		const ownerGroupCreateResponse =
			await createGroupConversationHttp(
				cookie,
				"Groupe transfert propriétaire",
				[
					presenceUserId,
					groupMemberUserId,
				],
			);

		const ownerGroupCreateBody =
			(await ownerGroupCreateResponse.json()) as
				GroupConversationResponse;

		if (
			!ownerGroupCreateResponse.ok ||
			!ownerGroupCreateBody.conversation
		) {
			throw new Error(
				`La création du groupe de transfert a échoué ` +
				`(${ownerGroupCreateResponse.status}) : ` +
				(ownerGroupCreateBody.error ??
					JSON.stringify(ownerGroupCreateBody)),
			);
		}

		ownerLeaveGroupId =
			ownerGroupCreateBody.conversation.id;

		const [
			ownerGroupCreatedForAlice,
			ownerGroupCreatedForBob,
			ownerGroupCreatedForCharlie,
		] = await Promise.all([
			ownerGroupCreatedForAlicePromise,
			ownerGroupCreatedForBobPromise,
			ownerGroupCreatedForCharliePromise,
		]);

		if (
			ownerGroupCreatedForAlice.id !== ownerLeaveGroupId ||
			ownerGroupCreatedForBob.id !== ownerLeaveGroupId ||
			ownerGroupCreatedForCharlie.id !== ownerLeaveGroupId
		) {
			throw new Error(
				"conversationCreated contient un mauvais identifiant pour le groupe de transfert.",
			);
		}

		const formerOwnerDeletedPromise =
			waitForConversationDeleted(socket);

		const ownerUpdatedForBobPromise =
			waitForConversationUpdated(receiverSocket);

		const ownerUpdatedForCharliePromise =
			waitForConversationUpdated(groupMemberSocket);

		const ownerLeaveResponse =
			await leaveGroupConversationHttp(
				cookie,
				ownerLeaveGroupId,
			);

		const ownerLeaveBody =
			(await ownerLeaveResponse.json()) as
				LeaveGroupConversationResponse;

		console.log(
			"Sortie volontaire du propriétaire :",
			ownerLeaveResponse.status,
			ownerLeaveBody,
		);

		if (
			!ownerLeaveResponse.ok ||
			ownerLeaveBody.deleted !== false ||
			!ownerLeaveBody.conversation
		) {
			throw new Error(
				`La sortie du propriétaire a échoué ` +
				`(${ownerLeaveResponse.status}) : ` +
				(ownerLeaveBody.error ??
					JSON.stringify(ownerLeaveBody)),
			);
		}

		const [
			formerOwnerDeleted,
			ownerUpdatedForBob,
			ownerUpdatedForCharlie,
		] = await Promise.all([
			formerOwnerDeletedPromise,
			ownerUpdatedForBobPromise,
			ownerUpdatedForCharliePromise,
		]);

		if (
			formerOwnerDeleted.conversationId !==
				ownerLeaveGroupId ||
			ownerUpdatedForBob.id !== ownerLeaveGroupId ||
			ownerUpdatedForCharlie.id !== ownerLeaveGroupId
		) {
			throw new Error(
				"Les événements de transfert de propriété contiennent un mauvais identifiant.",
			);
		}

		const expectedNewOwnerId = Math.min(
			presenceUserId,
			groupMemberUserId,
		);

		if (
			ownerLeaveBody.conversation.ownerId !==
				expectedNewOwnerId ||
			ownerUpdatedForBob.ownerId !==
				expectedNewOwnerId ||
			ownerUpdatedForCharlie.ownerId !==
				expectedNewOwnerId
		) {
			throw new Error(
				`Mauvais transfert de propriété : ` +
				`propriétaire attendu ${expectedNewOwnerId}.`,
			);
		}

		if (
			ownerLeaveBody.conversation.participants?.some(
				(participant) =>
					participant.userId === userId,
			)
		) {
			throw new Error(
				"L'ancien propriétaire figure encore parmi les participants.",
			);
		}

		const ownerIdInDatabase = Number.parseInt(
			runSql(`
SELECT "ownerId"
FROM "Conversation"
WHERE "id" = ${ownerLeaveGroupId};
`),
			10,
		);

		if (ownerIdInDatabase !== expectedNewOwnerId) {
			throw new Error(
				`La base contient le propriétaire ${ownerIdInDatabase} ` +
				`au lieu de ${expectedNewOwnerId}.`,
			);
		}

		const formerOwnerParticipantCount =
			Number.parseInt(
				runSql(`
SELECT COUNT(*)
FROM "ConversationParticipant"
WHERE "conversationId" = ${ownerLeaveGroupId}
AND "userId" = ${userId};
`),
				10,
			);

		if (formerOwnerParticipantCount !== 0) {
			throw new Error(
				"L'ancien propriétaire est encore participant en base.",
			);
		}

		console.log(
			"Test de transfert automatique de propriété réussi :",
			expectedNewOwnerId,
		);

		/*
		 * Le dernier membre quitte le groupe :
		 * la conversation doit être supprimée.
		 */
		const lastGroupCreatedForAlicePromise =
			waitForConversationCreated(socket);

		const lastGroupCreatedForBobPromise =
			waitForConversationCreated(receiverSocket);

		const lastGroupCreateResponse =
			await createGroupConversationHttp(
				cookie,
				"Groupe dernier membre",
				[presenceUserId],
			);

		const lastGroupCreateBody =
			(await lastGroupCreateResponse.json()) as
				GroupConversationResponse;

		if (
			!lastGroupCreateResponse.ok ||
			!lastGroupCreateBody.conversation
		) {
			throw new Error(
				`La création du groupe du dernier membre a échoué ` +
				`(${lastGroupCreateResponse.status}) : ` +
				(lastGroupCreateBody.error ??
					JSON.stringify(lastGroupCreateBody)),
			);
		}

		lastMemberGroupId =
			lastGroupCreateBody.conversation.id;

		const [
			lastGroupCreatedForAlice,
			lastGroupCreatedForBob,
		] = await Promise.all([
			lastGroupCreatedForAlicePromise,
			lastGroupCreatedForBobPromise,
		]);

		if (
			lastGroupCreatedForAlice.id !== lastMemberGroupId ||
			lastGroupCreatedForBob.id !== lastMemberGroupId
		) {
			throw new Error(
				"conversationCreated contient un mauvais identifiant pour le groupe du dernier membre.",
			);
		}

		/*
		 * Bob quitte d'abord. Alice reste seule et redevient
		 * automatiquement propriétaire.
		 */
		const bobDeletedFromLastGroupPromise =
			waitForConversationDeleted(receiverSocket);

		const lastGroupUpdatedForAlicePromise =
			waitForConversationUpdated(socket);

		const bobLeaveLastGroupResponse =
			await leaveGroupConversationHttp(
				presenceCookie,
				lastMemberGroupId,
			);

		const bobLeaveLastGroupBody =
			(await bobLeaveLastGroupResponse.json()) as
				LeaveGroupConversationResponse;

		if (
			!bobLeaveLastGroupResponse.ok ||
			bobLeaveLastGroupBody.deleted !== false ||
			!bobLeaveLastGroupBody.conversation
		) {
			throw new Error(
				`Le départ de l'avant-dernier membre a échoué ` +
				`(${bobLeaveLastGroupResponse.status}) : ` +
				(bobLeaveLastGroupBody.error ??
					JSON.stringify(bobLeaveLastGroupBody)),
			);
		}

		const [
			bobDeletedFromLastGroup,
			lastGroupUpdatedForAlice,
		] = await Promise.all([
			bobDeletedFromLastGroupPromise,
			lastGroupUpdatedForAlicePromise,
		]);

		if (
			bobDeletedFromLastGroup.conversationId !==
				lastMemberGroupId ||
			lastGroupUpdatedForAlice.id !==
				lastMemberGroupId
		) {
			throw new Error(
				"Les événements du départ de l'avant-dernier membre contiennent un mauvais identifiant.",
			);
		}

		if (
			lastGroupUpdatedForAlice.ownerId !== userId ||
			lastGroupUpdatedForAlice.participants?.length !== 1 ||
			lastGroupUpdatedForAlice.participants?.[0]?.userId !==
				userId
		) {
			throw new Error(
				"Le groupe ne contient pas uniquement le dernier membre attendu.",
			);
		}

		/*
		 * Alice est maintenant seule. Sa sortie doit supprimer
		 * définitivement la conversation.
		 */
		const lastMemberDeletedPromise =
			waitForConversationDeleted(socket);

		const lastMemberLeaveResponse =
			await leaveGroupConversationHttp(
				cookie,
				lastMemberGroupId,
			);

		const lastMemberLeaveBody =
			(await lastMemberLeaveResponse.json()) as
				LeaveGroupConversationResponse;

		console.log(
			"Sortie du dernier membre :",
			lastMemberLeaveResponse.status,
			lastMemberLeaveBody,
		);

		if (
			!lastMemberLeaveResponse.ok ||
			lastMemberLeaveBody.deleted !== true ||
			lastMemberLeaveBody.conversation !== null
		) {
			throw new Error(
				`La suppression du groupe vide a échoué ` +
				`(${lastMemberLeaveResponse.status}) : ` +
				(lastMemberLeaveBody.error ??
					JSON.stringify(lastMemberLeaveBody)),
			);
		}

		const lastMemberDeleted =
			await lastMemberDeletedPromise;

		if (
			lastMemberDeleted.conversationId !==
				lastMemberGroupId
		) {
			throw new Error(
				"conversationDeleted contient un mauvais identifiant après le départ du dernier membre.",
			);
		}

		const deletedConversationCount =
			Number.parseInt(
				runSql(`
SELECT COUNT(*)
FROM "Conversation"
WHERE "id" = ${lastMemberGroupId};
`),
				10,
			);

		if (deletedConversationCount !== 0) {
			throw new Error(
				"Le groupe du dernier membre existe encore en base.",
			);
		}

		const deletedParticipantsCount =
			Number.parseInt(
				runSql(`
SELECT COUNT(*)
FROM "ConversationParticipant"
WHERE "conversationId" = ${lastMemberGroupId};
`),
				10,
			);

		if (deletedParticipantsCount !== 0) {
			throw new Error(
				"Des participants du groupe supprimé existent encore en base.",
			);
		}

		console.log(
			"Test de suppression après le départ du dernier membre réussi.",
		);

		lastMemberGroupId = null;

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

		const replyResponse =
			await emitWithAck(
				receiverSocket,
				"sendMessage",
				{
					conversationId,
					content:
						"Réponse au message initial",
					replyToId:
						sendResponse.message.id,
				},
			);

		console.log(
			"Réponse à un message :",
			replyResponse,
		);

		if (
			!replyResponse.success ||
			!replyResponse.message
		) {
			throw new Error(
				"Impossible d'envoyer une réponse à un message.",
			);
		}

		if (
			replyResponse.message.replyToId !==
				sendResponse.message.id ||
			replyResponse.message.replyTo?.id !==
				sendResponse.message.id ||
			replyResponse.message.replyTo?.content !==
				"Message modifié"
		) {
			throw new Error(
				"Les informations du message cité sont invalides.",
			);
		}

		const replyHistory =
			await emitWithAck(
				socket,
				"getMessages",
				{
					conversationId,
					limit: 50,
				},
			);

		console.log(
			"Historique avec réponse :",
			replyHistory,
		);

		if (!replyHistory.success) {
			throw new Error(
				"Impossible de récupérer l'historique avec la réponse.",
			);
		}

		const replyInHistory =
			replyHistory.messages?.find(
				(message) =>
					message.id ===
					replyResponse.message!.id,
			);

		if (
			!replyInHistory ||
			replyInHistory.replyTo?.id !==
				sendResponse.message.id
		) {
			throw new Error(
				"La réponse ou son message cité est absent de l'historique.",
			);
		}

		const reactionAddedPromise =
			waitForMessageReactionAdded(
				receiverSocket,
			);

		const addReactionResponse =
			await emitWithAck(
				socket,
				"message:addReaction",
				{
					messageId:
						sendResponse.message.id,
					emoji: "👍",
				},
			);

		const reactionAdded =
			await reactionAddedPromise;

		console.log(
			"Réaction ajoutée :",
			addReactionResponse,
			reactionAdded,
		);

		if (
			!addReactionResponse.success ||
			!addReactionResponse.reaction ||
			addReactionResponse.reaction.messageId !==
				sendResponse.message.id ||
			addReactionResponse.reaction.emoji !== "👍" ||
			reactionAdded.messageId !==
				sendResponse.message.id ||
			reactionAdded.conversationId !==
				conversationId ||
			reactionAdded.emoji !== "👍"
		) {
			throw new Error(
				"La réaction 👍 n'a pas été correctement ajoutée.",
			);
		}

		const firstReactionId =
			addReactionResponse.reaction.id;

		const reactionUpdatedPromise =
			waitForMessageReactionAdded(
				receiverSocket,
			);

		const updateReactionResponse =
			await emitWithAck(
				socket,
				"message:addReaction",
				{
					messageId:
						sendResponse.message.id,
					emoji: "❤️",
				},
			);

		const reactionUpdated =
			await reactionUpdatedPromise;

		console.log(
			"Réaction remplacée :",
			updateReactionResponse,
			reactionUpdated,
		);

		if (
			!updateReactionResponse.success ||
			!updateReactionResponse.reaction ||
			updateReactionResponse.reaction.id !==
				firstReactionId ||
			updateReactionResponse.reaction.emoji !==
				"❤️" ||
			reactionUpdated.emoji !== "❤️"
		) {
			throw new Error(
				"La réaction n'a pas été remplacée par ❤️.",
			);
		}

		const reactionHistory =
			await emitWithAck(
				socket,
				"getMessages",
				{
					conversationId,
					limit: 50,
				},
			);

		console.log(
			"Historique avec réaction :",
			reactionHistory,
		);

		const reactedMessage =
			reactionHistory.messages?.find(
				(message) =>
					message.id ===
					sendResponse.message!.id,
			);

		if (
			!reactionHistory.success ||
			!reactedMessage ||
			reactedMessage.reactions?.length !== 1 ||
			reactedMessage.reactions[0]?.emoji !== "❤️"
		) {
			throw new Error(
				"La réaction ❤️ est absente ou invalide dans l'historique.",
			);
		}

		const reactionRemovedPromise =
			waitForMessageReactionRemoved(
				receiverSocket,
			);

		const removeReactionResponse =
			await emitWithAck(
				socket,
				"message:removeReaction",
				{
					messageId:
						sendResponse.message.id,
				},
			);

		const reactionRemoved =
			await reactionRemovedPromise;

		console.log(
			"Réaction supprimée :",
			removeReactionResponse,
			reactionRemoved,
		);

		if (
			!removeReactionResponse.success ||
			!removeReactionResponse.removedReaction ||
			removeReactionResponse.removedReaction.messageId !==
				sendResponse.message.id ||
			reactionRemoved.messageId !==
				sendResponse.message.id ||
			reactionRemoved.conversationId !==
				conversationId
		) {
			throw new Error(
				"La réaction n'a pas été correctement supprimée.",
			);
		}

		const historyAfterReactionRemoval =
			await emitWithAck(
				socket,
				"getMessages",
				{
					conversationId,
					limit: 50,
				},
			);

		const messageAfterReactionRemoval =
			historyAfterReactionRemoval.messages?.find(
				(message) =>
					message.id ===
					sendResponse.message!.id,
			);

		if (
			!historyAfterReactionRemoval.success ||
			!messageAfterReactionRemoval ||
			messageAfterReactionRemoval.reactions?.length !== 0
		) {
			throw new Error(
				"La réaction est toujours présente dans l'historique après sa suppression.",
			);
		}

		console.log(
			"Tests des réactions réussis.",
		);

		const forbiddenDeleteResponse =
			await deleteMessageHttp(
				presenceCookie,
				sendResponse.message.id,
			);

		console.log(
			"Suppression interdite par un autre utilisateur :",
			forbiddenDeleteResponse.status,
		);

		if (forbiddenDeleteResponse.status !== 403) {
			throw new Error(
				`La suppression par un autre utilisateur devait retourner 403, reçu ${forbiddenDeleteResponse.status}.`,
			);
		}

		const deletedMessagePromiseAlice =
			waitForMessageDeleted(socket);

		const deletedMessagePromiseBob =
			waitForMessageDeleted(receiverSocket);

		const deleteMessageResponse =
			await deleteMessageHttp(
				cookie,
				sendResponse.message.id,
			);

		if (!deleteMessageResponse.ok) {
			throw new Error(
				`DELETE /messages a échoué (${deleteMessageResponse.status})`,
			);
		}

		const deletedMessageAlice =
			await deletedMessagePromiseAlice;

		const deletedMessageBob =
			await deletedMessagePromiseBob;

		console.log(
			"Événement messageDeleted reçu :",
			deletedMessageAlice,
			deletedMessageBob,
		);

		if (
			deletedMessageAlice.id !==
				sendResponse.message.id ||
			deletedMessageBob.id !==
				sendResponse.message.id ||
			deletedMessageAlice.conversationId !==
				conversationId ||
			deletedMessageBob.conversationId !==
				conversationId
		) {
			throw new Error(
				"Le contenu de messageDeleted est invalide.",
			);
		}

		const historyAfterDelete =
			await emitWithAck(
				socket,
				"getMessages",
				{
					conversationId,
					limit: 50,
				},
			);

		console.log(
			"Historique après suppression :",
			historyAfterDelete,
		);

		if (!historyAfterDelete.success) {
			throw new Error(
				"Impossible de récupérer l'historique après suppression.",
			);
		}

		const deletedMessageStillExists =
			historyAfterDelete.messages?.some(
				(message) =>
					message.id === sendResponse.message!.id,
			);

		if (deletedMessageStillExists) {
			throw new Error(
				"Le message supprimé est toujours présent dans l'historique.",
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

		if (groupMemberSocket) {
			groupMemberSocket.disconnect();
		}

		if (receiverSocket) {
			receiverSocket.disconnect();
		}

		if (socket) {
			socket.disconnect();
		}

		if (lastMemberGroupId !== null) {
			deleteTestConversation(lastMemberGroupId);

			console.log(
				`Groupe du dernier membre ${lastMemberGroupId} supprimé.`,
			);
		}

		if (ownerLeaveGroupId !== null) {
			deleteTestConversation(ownerLeaveGroupId);

			console.log(
				`Groupe de transfert ${ownerLeaveGroupId} supprimé.`,
			);
		}

		if (groupConversationId !== null) {
			deleteTestConversation(groupConversationId);

			console.log(
				`Groupe temporaire ${groupConversationId} supprimé.`,
			);
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
