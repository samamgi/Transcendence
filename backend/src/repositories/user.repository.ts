import { prisma } from "../lib/prisma.js";

export class UserRepository {
	async create(data: {
		username: string;
		email: string;
		passwordHash: string;
	}) {
		return prisma.user.create({
			data,
			omit: {
				passwordHash: true,
			},
		});
	}

	async findById(id: number) {
		return prisma.user.findUnique({
			where: { id },
			omit: {
				passwordHash: true,
			},
		});
	}

	async findPublicById(id: number) {
		return prisma.user.findUnique({
			where: { id },
			select: {
				id: true,
				username: true,
				displayName: true,
				avatarUrl: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	}

	async findByEmail(email: string) {
		return prisma.user.findUnique({
			where: { email },
		});
	}

	async findByUsername(username: string) {
		return prisma.user.findUnique({
			where: { username },
		});
	}

	async updateProfile(
		id: number,
		data: {
			username?: string;
			displayName?: string | null;
		},
	) {
		return prisma.user.update({
			where: { id },
			data,
			omit: {
				passwordHash: true,
			},
		});
	}

	async updateAvatar(
		id: number,
		avatarUrl: string,
	) {
		return prisma.user.update({
			where: { id },
			data: {
				avatarUrl,
			},
			omit: {
				passwordHash: true,
			},
		});
	}

	async searchUsers(
		userId: number,
		query: string,
	) {
		const users = await prisma.user.findMany({
			where: {
				AND: [
					{
						id: {
							not: userId,
						},
					},
					{
						OR: [
							{
								username: {
									contains: query,
									mode: "insensitive",
								},
							},
							{
								displayName: {
									contains: query,
									mode: "insensitive",
								},
							},
						],
					},
				],
			},
			select: {
				id: true,
				username: true,
				displayName: true,
				avatarUrl: true,
			},
			take: 10,
			orderBy: {
				username: "asc",
			},
		});

		if (users.length === 0) {
			return [];
		}

		const resultUserIds = users.map(
			(user) => user.id,
		);

		const [friendships, requests] =
			await Promise.all([
				prisma.friend.findMany({
					where: {
						OR: [
							{
								user1Id: userId,
								user2Id: {
									in: resultUserIds,
								},
							},
							{
								user2Id: userId,
								user1Id: {
									in: resultUserIds,
								},
							},
						],
					},
					select: {
						user1Id: true,
						user2Id: true,
					},
				}),
				prisma.friendRequest.findMany({
					where: {
						status: "PENDING",
						OR: [
							{
								senderId: userId,
								receiverId: {
									in: resultUserIds,
								},
							},
							{
								receiverId: userId,
								senderId: {
									in: resultUserIds,
								},
							},
						],
					},
					select: {
						senderId: true,
						receiverId: true,
					},
				}),
			]);

		const friendIds = new Set<number>();

		for (const friendship of friendships) {
			friendIds.add(
				friendship.user1Id === userId
					? friendship.user2Id
					: friendship.user1Id,
			);
		}

		const sentRequestIds = new Set<number>();
		const receivedRequestIds = new Set<number>();

		for (const request of requests) {
			if (request.senderId === userId) {
				sentRequestIds.add(request.receiverId);
			} else {
				receivedRequestIds.add(request.senderId);
			}
		}

		return users.map((user) => {
			let relationship:
				| "NONE"
				| "PENDING_SENT"
				| "PENDING_RECEIVED"
				| "FRIEND" = "NONE";

			if (friendIds.has(user.id)) {
				relationship = "FRIEND";
			} else if (sentRequestIds.has(user.id)) {
				relationship = "PENDING_SENT";
			} else if (
				receivedRequestIds.has(user.id)
			) {
				relationship = "PENDING_RECEIVED";
			}

			return {
				...user,
				relationship,
			};
		});
	}
}

export const userRepository =
	new UserRepository();
