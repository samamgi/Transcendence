import type { NextFunction, Request, Response } from "express";
import { authService } from "../services/auth.service.js";

const COOKIE_NAME = "transcendence.sid";

export class AuthController {
	async register(
		request: Request,
		response: Response,
		next: NextFunction,
	) {
		try {
			const user = await authService.register(request.body);

			request.session.regenerate((regenerateError) => {
				if (regenerateError) {
					next(regenerateError);
					return;
				}

				request.session.userId = user.id;

				request.session.save((saveError) => {
					if (saveError) {
						next(saveError);
						return;
					}

					response.status(201).json({
						message: "Registration successful",
						user,
					});
				});
			});
		} catch (error) {
			next(error);
		}
	}

	async login(
		request: Request,
		response: Response,
		next: NextFunction,
	) {
		try {
			const user = await authService.login(request.body);

			request.session.regenerate((regenerateError) => {
				if (regenerateError) {
					next(regenerateError);
					return;
				}

				request.session.userId = user.id;

				request.session.save((saveError) => {
					if (saveError) {
						next(saveError);
						return;
					}

					response.status(200).json({
						message: "Login successful",
						user,
					});
				});
			});
		} catch (error) {
			next(error);
		}
	}

	async me(
		request: Request,
		response: Response,
		next: NextFunction,
	) {
		try {
			const userId = request.session.userId as number;
			const user = await authService.getAuthenticatedUser(userId);

			response.status(200).json({
				user,
			});
		} catch (error) {
			request.session.destroy(() => {
				response.clearCookie(COOKIE_NAME, {
					httpOnly: true,
					secure: process.env.NODE_ENV === "production",
					sameSite: "lax",
				});

				next(error);
			});
		}
	}

	async logout(
		request: Request,
		response: Response,
		next: NextFunction,
	) {
		request.session.destroy((error) => {
			if (error) {
				next(error);
				return;
			}

			response.clearCookie(COOKIE_NAME, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
			});

			response.status(200).json({
				message: "Logout successful",
			});
		});
	}
}

export const authController = new AuthController();
