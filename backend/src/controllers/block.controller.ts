import type { Request, Response } from "express";
import { blockService } from "../services/block.service.js";

export class BlockController {
	async blockUser(
		request: Request,
		response: Response,
	) {
		const block = await blockService.blockUser(
			request.session.userId!,
			Number(request.params.userId),
		);

		response.status(201).json({
			message: "User blocked",
			block,
		});
	}

	async unblockUser(
		request: Request,
		response: Response,
	) {
		await blockService.unblockUser(
			request.session.userId!,
			Number(request.params.userId),
		);

		response.status(200).json({
			message: "User unblocked",
		});
	}

	async getBlockedUsers(
		request: Request,
		response: Response,
	) {
		const blockedUsers =
			await blockService.getBlockedUsers(
				request.session.userId!,
			);

		response.status(200).json({
			blockedUsers,
		});
	}
}

export const blockController = new BlockController();
