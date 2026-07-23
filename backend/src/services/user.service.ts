import fs from "node:fs/promises";
import path from "node:path";
import { HttpError } from "../lib/http-error.js";
import { userRepository } from "../repositories/user.repository.js";

type UpdateProfileInput = {
	username?: unknown;
	displayName?: unknown;
};

export class UserService {
	async getMe(userId: number) {
		const user = await userRepository.findById(userId);

		if (!user) {
			throw new HttpError(404, "User not found");
		}

		return user;
	}

	async getById(id: number) {
		if (!Number.isInteger(id) || id <= 0) {
			throw new HttpError(400, "Invalid user id");
		}

		const user = await userRepository.findPublicById(id);

		if (!user) {
			throw new HttpError(404, "User not found");
		}

		return user;
	}

	async updateProfile(
		userId: number,
		data: UpdateProfileInput,
	) {
		const currentUser = await userRepository.findById(userId);

		if (!currentUser) {
			throw new HttpError(404, "User not found");
		}

		const updateData: {
			username?: string;
			displayName?: string | null;
		} = {};

		if (data.username !== undefined) {
			if (typeof data.username !== "string") {
				throw new HttpError(400, "Invalid username");
			}

			const username = data.username.trim();

			if (username.length < 3 || username.length > 20) {
				throw new HttpError(
					400,
					"Username must contain between 3 and 20 characters",
				);
			}

			if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
				throw new HttpError(400, "Invalid username");
			}

			const existingUser =
				await userRepository.findByUsername(username);

			if (
				existingUser &&
				existingUser.id !== userId
			) {
				throw new HttpError(
					409,
					"Username already exists",
				);
			}

			updateData.username = username;
		}

		if (data.displayName !== undefined) {
			if (
				data.displayName !== null &&
				typeof data.displayName !== "string"
			) {
				throw new HttpError(
					400,
					"Invalid display name",
				);
			}

			if (data.displayName === null) {
				updateData.displayName = null;
			} else {
				const displayName = data.displayName.trim();

				if (displayName.length > 50) {
					throw new HttpError(
						400,
						"Display name must contain at most 50 characters",
					);
				}

				updateData.displayName =
					displayName.length === 0
						? null
						: displayName;
			}
		}

		if (Object.keys(updateData).length === 0) {
			throw new HttpError(
				400,
				"No profile fields to update",
			);
		}

		return userRepository.updateProfile(
			userId,
			updateData,
		);
	}

	async updateAvatar(
		userId: number,
		file?: Express.Multer.File,
	) {
		const user = await userRepository.findById(userId);

		if (!user) {
			throw new HttpError(404, "User not found");
		}

		if (!file) {
			throw new HttpError(400, "Avatar file is required");
		}

		const avatarUrl = `/uploads/avatars/${path.basename(file.filename)}`;

		try {
			const updatedUser =
				await userRepository.updateAvatar(
					userId,
					avatarUrl,
				);

			if (user.avatarUrl) {
				const oldFile = path.resolve(
					"." + user.avatarUrl,
				);

				await fs.rm(oldFile, {
					force: true,
				});
			}

			return updatedUser;
		} catch (error) {
			await fs.rm(file.path, {
				force: true,
			});

			throw error;
		}
	}

	async searchUsers(
		userId: number,
		query: string,
	) {
		const search = query.trim();

		if (search.length < 2) {
			throw new HttpError(
				400,
				"Search query must contain at least 2 characters",
			);
		}

		return userRepository.searchUsers(
			userId,
			search,
		);
	}

}

export const userService = new UserService();
