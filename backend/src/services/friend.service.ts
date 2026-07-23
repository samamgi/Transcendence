import { HttpError } from "../lib/http-error.js";
import { friendRepository } from "../repositories/friend.repository.js";

export class FriendService {
	async sendRequest(
		senderId: number,
		receiverId: number,
	) {
		if (!Number.isInteger(receiverId) || receiverId <= 0) {
			throw new HttpError(400, "Invalid user id");
		}

		if (senderId === receiverId) {
			throw new HttpError(
				400,
				"You cannot send a friend request to yourself",
			);
		}

		const receiver =
			await friendRepository.findUserById(receiverId);

		if (!receiver) {
			throw new HttpError(404, "User not found");
		}

		const friendship =
			await friendRepository.areFriends(
				senderId,
				receiverId,
			);

		if (friendship) {
			throw new HttpError(
				409,
				"Users are already friends",
			);
		}

		const existingRequest =
			await friendRepository.findFriendRequest(
				senderId,
				receiverId,
			);

		if (existingRequest) {
			throw new HttpError(
				409,
				"Friend request already sent",
			);
		}

		const reverseRequest =
			await friendRepository.findFriendRequest(
				receiverId,
				senderId,
			);

		if (reverseRequest) {
			throw new HttpError(
				409,
				"This user already sent you a friend request",
			);
		}

		return friendRepository.createFriendRequest(
			senderId,
			receiverId,
		);
	}
	async getReceivedRequests(userId: number) {
		return friendRepository.findReceivedRequests(userId);
	}

	async acceptRequest(
		requestId: number,
		userId: number,
	) {
		if (!Number.isInteger(requestId) || requestId <= 0) {
			throw new HttpError(
				400,
				"Invalid request id",
			);
		}

		const request =
			await friendRepository.findRequestById(
				requestId,
			);

		if (!request) {
			throw new HttpError(
				404,
				"Friend request not found",
			);
		}

		if (request.receiverId !== userId) {
			throw new HttpError(
				403,
				"You cannot accept this friend request",
			);
		}

		const friendship =
			await friendRepository.areFriends(
				request.senderId,
				request.receiverId,
			);

		if (friendship) {
			throw new HttpError(
				409,
				"Users are already friends",
			);
		}

		return friendRepository.acceptRequest(
			requestId,
		);
	}

	async declineRequest(
		requestId: number,
		userId: number,
	) {
		if (!Number.isInteger(requestId) || requestId <= 0) {
			throw new HttpError(
				400,
				"Invalid request id",
			);
		}

		const request =
			await friendRepository.findRequestById(
				requestId,
			);

		if (!request) {
			throw new HttpError(
				404,
				"Friend request not found",
			);
		}

		if (request.receiverId !== userId) {
			throw new HttpError(
				403,
				"You cannot decline this friend request",
			);
		}

		await friendRepository.declineRequest(
			requestId,
		);

		return;
	}

	async getFriends(userId: number) {
		return friendRepository.getFriends(userId);
	}

	async deleteFriend(
		userId: number,
		friendId: number,
	) {
		if (!Number.isInteger(friendId) || friendId <= 0) {
			throw new HttpError(
				400,
				"Invalid user id",
			);
		}

		const friendship =
			await friendRepository.areFriends(
				userId,
				friendId,
			);

		if (!friendship) {
			throw new HttpError(
				404,
				"Friendship not found",
			);
		}

		await friendRepository.deleteFriendship(
			userId,
			friendId,
		);
	}

}

export const friendService = new FriendService();
