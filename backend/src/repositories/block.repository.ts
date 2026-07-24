import { prisma } from "../lib/prisma.js";

export class BlockRepository {
	async findUserById(id: number) {
		return prisma.user.findUnique({
			where: {
				id,
			},
		});
	}

	async blockUser(
		blockerId: number,
		blockedId: number,
	) {
		return prisma.userBlock.create({
			data: {
				blockerId,
				blockedId,
			},
		});
	}

	async unblockUser(
		blockerId: number,
		blockedId: number,
	) {
		return prisma.userBlock.delete({
			where: {
				blockerId_blockedId: {
					blockerId,
					blockedId,
				},
			},
		});
	}

	async findBlock(
		blockerId: number,
		blockedId: number,
	) {
		return prisma.userBlock.findUnique({
			where: {
				blockerId_blockedId: {
					blockerId,
					blockedId,
				},
			},
		});
	}

	async isBlockedBetween(
		user1Id: number,
		user2Id: number,
	) {
		return prisma.userBlock.findFirst({
			where: {
				OR: [
					{
						blockerId: user1Id,
						blockedId: user2Id,
					},
					{
						blockerId: user2Id,
						blockedId: user1Id,
					},
				],
			},
		});
	}

	async findBlockedUsers(blockerId: number) {
		return prisma.userBlock.findMany({
			where: {
				blockerId,
			},
			include: {
				blocked: {
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
	}
}

export const blockRepository =
	new BlockRepository();
