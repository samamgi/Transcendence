import type { Request, Response } from "express";
import { friendService } from "../services/friend.service.js";

export class FriendController {
	async sendRequest(
		request: Request,
		response: Response,
	) {
		const senderId = request.session.userId!;
		const receiverId = Number(request.params.userId);

		const friendRequest =
			await friendService.sendRequest(
				senderId,
				receiverId,
			);

		response.status(201).json({
			message: "Friend request sent",
			friendRequest,
		});
	}
	async getReceivedRequests(
		request: Request,
		response: Response,
	) {
		const requests =
			await friendService.getReceivedRequests(
				request.session.userId!,
			);

		response.status(200).json({
			requests,
		});
	}

	async acceptRequest(
		request: Request,
		response: Response,
	) {
		const friendship =
			await friendService.acceptRequest(
				Number(request.params.requestId),
				request.session.userId!,
			);

		response.status(200).json({
			message: "Friend request accepted",
			friendship,
		});
	}

	async declineRequest(
		request: Request,
		response: Response,
	) {
		await friendService.declineRequest(
			Number(request.params.requestId),
			request.session.userId!,
		);

		response.status(200).json({
			message: "Friend request declined",
		});
	}

	async getFriends(
		request: Request,
		response: Response,
	) {
		const friends =
			await friendService.getFriends(
				request.session.userId!,
			);

		response.status(200).json({
			friends,
		});
	}

	async deleteFriend(
		request: Request,
		response: Response,
	) {
		await friendService.deleteFriend(
			request.session.userId!,
			Number(request.params.userId),
		);

		response.status(200).json({
			message: "Friend removed",
		});
	}

}

export const friendController = new FriendController();
