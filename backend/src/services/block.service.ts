import { HttpError } from "../lib/http-error.js";
import { blockRepository } from "../repositories/block.repository.js";

export class BlockService {
	async blockUser(
		blockerId: number,
		blockedId: number,
	) {
		if (!Number.isInteger(blockedId) || blockedId <= 0) {
			throw new HttpError(
				400,
				"Invalid user id",
			);
		}

		if (blockerId === blockedId) {
			throw new HttpError(
				400,
				"You cannot block yourself",
			);
		}

		const blockedUser =
			await blockRepository.findUserById(blockedId);

		if (!blockedUser) {
			throw new HttpError(
				404,
				"User not found",
			);
		}

		const existingBlock =
			await blockRepository.findBlock(
				blockerId,
				blockedId,
			);

		if (existingBlock) {
			throw new HttpError(
				409,
				"User is already blocked",
			);
		}

		return blockRepository.blockUser(
			blockerId,
			blockedId,
		);
	}

	async unblockUser(
		blockerId: number,
		blockedId: number,
	) {
		if (!Number.isInteger(blockedId) || blockedId <= 0) {
			throw new HttpError(
				400,
				"Invalid user id",
			);
		}

		const existingBlock =
			await blockRepository.findBlock(
				blockerId,
				blockedId,
			);

		if (!existingBlock) {
			throw new HttpError(
				404,
				"Block not found",
			);
		}

		await blockRepository.unblockUser(
			blockerId,
			blockedId,
		);
	}

	async getBlockedUsers(userId: number) {
		const blocks =
			await blockRepository.findBlockedUsers(userId);

		return blocks.map((block) => block.blocked);
	}

	async isBlockedBetween(
		user1Id: number,
		user2Id: number,
	) {
		return Boolean(
			await blockRepository.isBlockedBetween(
				user1Id,
				user2Id,
			),
		);
	}
}

export const blockService = new BlockService();
