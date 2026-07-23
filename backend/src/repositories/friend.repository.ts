import { prisma } from "../lib/prisma.js";
import { FriendRequestStatus } from "../generated/prisma/enums.js";

export class FriendRepository {
	async createFriendRequest(
		senderId: number,
		receiverId: number,
	) {
		return prisma.friendRequest.create({
			data: {
				senderId,
				receiverId,
				status: FriendRequestStatus.PENDING,
			},
		});
	}

	async findFriendRequest(
		senderId: number,
		receiverId: number,
	) {
		return prisma.friendRequest.findUnique({
			where: {
				senderId_receiverId: {
					senderId,
					receiverId,
				},
			},
		});
	}

	async findReceivedRequests(receiverId: number) {
		return prisma.friendRequest.findMany({
			where: {
				receiverId,
				status: FriendRequestStatus.PENDING,
			},
			orderBy: {
				createdAt: "desc",
			},
			include: {
				sender: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true,
					},
				},
			},
		});
	}

	async findUserById(id: number) {
		return prisma.user.findUnique({
			where: {
				id,
			},
		});
	}

	async areFriends(
		user1Id: number,
		user2Id: number,
	) {
		const [a, b] =
			user1Id < user2Id
				? [user1Id, user2Id]
				: [user2Id, user1Id];

		return prisma.friend.findUnique({
			where: {
				user1Id_user2Id: {
					user1Id: a,
					user2Id: b,
				},
			},
		});
	}
	async findRequestById(id: number) {
		return prisma.friendRequest.findUnique({
			where: {
				id,
			},
		});
	}

	async acceptRequest(requestId: number) {
		return prisma.$transaction(async (tx) => {
			const request =
				await tx.friendRequest.findUnique({
					where: {
						id: requestId,
					},
				});

			if (!request) {
				throw new Error("Friend request not found");
			}

			const [user1Id, user2Id] =
				request.senderId < request.receiverId
					? [request.senderId, request.receiverId]
					: [request.receiverId, request.senderId];

			const friendship =
				await tx.friend.create({
					data: {
						user1Id,
						user2Id,
					},
				});

			await tx.friendRequest.delete({
				where: {
					id: requestId,
				},
			});

			return friendship;
		});
	}

	async declineRequest(requestId: number) {
		return prisma.friendRequest.delete({
			where: {
				id: requestId,
			},
		});
	}

	async getFriends(userId: number) {
		const friendships = await prisma.friend.findMany({
			where: {
				OR: [
					{ user1Id: userId },
					{ user2Id: userId },
				],
			},
			include: {
				user1: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true,
					},
				},
				user2: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true,
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		return friendships.map((friendship) =>
			friendship.user1Id === userId
				? friendship.user2
				: friendship.user1,
		);
	}

	async deleteFriendship(
		user1Id: number,
		user2Id: number,
	) {
		const [a, b] =
			user1Id < user2Id
				? [user1Id, user2Id]
				: [user2Id, user1Id];

		await prisma.friend.delete({
			where: {
				user1Id_user2Id: {
					user1Id: a,
					user2Id: b,
				},
			},
		});
	}

}

export const friendRepository = new FriendRepository();
