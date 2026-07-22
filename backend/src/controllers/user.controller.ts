import type { Request, Response } from "express";
import { userService } from "../services/user.service.js";

export class UserController {
	async getAllUsers(_request: Request, response: Response) {
		try {
			const users = await userService.getAllUsers();

			response.status(200).json(users);
		} catch (error) {
			console.error("Unable to list users:", error);

			response.status(500).json({
				error: "Internal server error",
			});
		}
	}

	async createUser(request: Request, response: Response) {
		try {
			const user = await userService.createUser(request.body);

			response.status(201).json(user);
		} catch (error) {
			response.status(400).json({
				error: error instanceof Error
					? error.message
					: "Invalid request",
			});
		}
	}
}

export const userController = new UserController();