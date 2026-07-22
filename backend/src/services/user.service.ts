import bcrypt from "bcryptjs";
import { userRepository } from "../repositories/user.repository.js";

type CreateUserInput = {
	username?: unknown;
	email?: unknown;
	password?: unknown;
};

export class UserService {
	async getAllUsers() {
		return userRepository.findAll();
	}

	async createUser(data: CreateUserInput) {
		if (
			typeof data.username !== "string"
			|| typeof data.email !== "string"
			|| typeof data.password !== "string"
		) {
			throw new Error("Username, email and password are required");
		}

		const username = data.username.trim();
		const email = data.email.trim().toLowerCase();
		const password = data.password;

		if (username.length < 3 || username.length > 20) {
			throw new Error("Username must contain between 3 and 20 characters");
		}

		if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
			throw new Error(
				"Username may only contain letters, numbers, underscores and hyphens",
			);
		}

		if (!email.includes("@") || email.length > 254) {
			throw new Error("Invalid email address");
		}

		if (password.length < 8 || password.length > 72) {
			throw new Error("Password must contain between 8 and 72 characters");
		}

		const existingUsername =
			await userRepository.findByUsername(username);

		if (existingUsername) {
			throw new Error("Username already exists");
		}

		const existingEmail = await userRepository.findByEmail(email);

		if (existingEmail) {
			throw new Error("Email already exists");
		}

		const passwordHash = await bcrypt.hash(password, 12);

		return userRepository.create({
			username,
			email,
			passwordHash,
		});
	}
}

export const userService = new UserService();