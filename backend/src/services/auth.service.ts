import bcrypt from "bcryptjs";
import { HttpError } from "../lib/http-error.js";
import { userRepository } from "../repositories/user.repository.js";

type LoginInput = {
	email?: unknown;
	password?: unknown;
};

type RegisterInput = {
	username?: unknown;
	email?: unknown;
	password?: unknown;
};

export class AuthService {
	async register(data: RegisterInput) {
		if (
			typeof data.username !== "string"
			|| typeof data.email !== "string"
			|| typeof data.password !== "string"
		) {
			throw new HttpError(
				400,
				"Username, email and password are required",
			);
		}

		const username = data.username.trim();
		const email = data.email.trim().toLowerCase();
		const password = data.password;

		if (username.length < 3 || username.length > 20) {
			throw new HttpError(
				400,
				"Username must contain between 3 and 20 characters",
			);
		}

		if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
			throw new HttpError(400, "Invalid username");
		}

		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			throw new HttpError(400, "Invalid email");
		}

		if (password.length < 8) {
			throw new HttpError(
				400,
				"Password must contain at least 8 characters",
			);
		}

		if (await userRepository.findByUsername(username)) {
			throw new HttpError(409, "Username already exists");
		}

		if (await userRepository.findByEmail(email)) {
			throw new HttpError(409, "Email already exists");
		}

		const passwordHash = await bcrypt.hash(password, 12);

		return userRepository.create({
			username,
			email,
			passwordHash,
		});
	}

	async login(data: LoginInput) {
		if (
			typeof data.email !== "string"
			|| typeof data.password !== "string"
		) {
			throw new HttpError(400, "Email and password are required");
		}

		const email = data.email.trim().toLowerCase();
		const password = data.password;

		if (!email || !password) {
			throw new HttpError(400, "Email and password are required");
		}

		const user = await userRepository.findByEmail(email);

		if (!user) {
			throw new HttpError(401, "Invalid credentials");
		}

		const validPassword = await bcrypt.compare(
			password,
			user.passwordHash,
		);

		if (!validPassword) {
			throw new HttpError(401, "Invalid credentials");
		}

		const { passwordHash, ...safeUser } = user;

		return safeUser;
	}

	async getAuthenticatedUser(userId: number) {
		const user = await userRepository.findById(userId);

		if (!user) {
			throw new HttpError(401, "Not authenticated");
		}

		return user;
	}
}

export const authService = new AuthService();
