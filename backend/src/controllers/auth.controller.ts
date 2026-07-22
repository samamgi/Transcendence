import type { Request, Response } from "express";
import { authService } from "../services/auth.service.js";

const COOKIE_NAME = "transcendence.sid";

export class AuthController {
	async register(
		request: Request,
		response: Response,
	) {
		const user = await authService.register(request.body);

		await new Promise<void>((resolve, reject) => {
			request.session.regenerate((error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve();
			});
		});

		request.session.userId = user.id;

		await new Promise<void>((resolve, reject) => {
			request.session.save((error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve();
			});
		});

		response.status(201).json({
			message: "Registration successful",
			user,
		});
	}

	async login(
		request: Request,
		response: Response,
	) {
		const user = await authService.login(request.body);

		await new Promise<void>((resolve, reject) => {
			request.session.regenerate((error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve();
			});
		});

		request.session.userId = user.id;

		await new Promise<void>((resolve, reject) => {
			request.session.save((error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve();
			});
		});

		response.status(200).json({
			message: "Login successful",
			user,
		});
	}

	async me(
		request: Request,
		response: Response,
	) {
		const userId = request.session.userId as number;
		const user = await authService.getAuthenticatedUser(userId);

		response.status(200).json({
			user,
		});
	}

	async logout(
		request: Request,
		response: Response,
	) {
		await new Promise<void>((resolve, reject) => {
			request.session.destroy((error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve();
			});
		});

		response.clearCookie(COOKIE_NAME, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
		});

		response.status(200).json({
			message: "Logout successful",
		});
	}
}

export const authController = new AuthController();
