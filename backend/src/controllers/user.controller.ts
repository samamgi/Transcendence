import type { Request, Response } from "express";
import { userService } from "../services/user.service.js";

export class UserController {
	async getMe(
		request: Request,
		response: Response,
	) {
		const user = await userService.getMe(
			request.session.userId!,
		);

		response.json({
			user,
		});
	}

	async getById(
		request: Request,
		response: Response,
	) {
		const user = await userService.getById(
			Number(request.params.id),
		);

		response.json({
			user,
		});
	}

	async updateMe(
		request: Request,
		response: Response,
	) {
		const user = await userService.updateProfile(
			request.session.userId!,
			request.body,
		);

		response.json({
			message: "Profile updated",
			user,
		});
	}

	async updateAvatar(
		request: Request,
		response: Response,
	) {
		const user = await userService.updateAvatar(
			request.session.userId!,
			request.file,
		);

		response.json({
			message: "Avatar updated",
			user,
		});
	}
	async searchUsers(
		request: Request,
		response: Response,
	) {
		const users =
			await userService.searchUsers(
				request.session.userId!,
				String(request.query.query ?? ""),
			);

		response.status(200).json({
			users,
		});
	}

}

export const userController = new UserController();
