import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

export class UserRepository {
	async create(data: Prisma.UserCreateInput) {
		return prisma.user.create({
			data,
			omit: {
				passwordHash: true,
			},
		});
	}

	async findById(id: number) {
		return prisma.user.findUnique({
			where: {
				id,
			},
			omit: {
				passwordHash: true,
			},
		});
	}

	async findByUsername(username: string) {
		return prisma.user.findUnique({
			where: {
				username,
			},
		});
	}

	async findByEmail(email: string) {
		return prisma.user.findUnique({
			where: {
				email,
			},
		});
	}

	async findAll() {
		return prisma.user.findMany({
			omit: {
				passwordHash: true,
			},
			orderBy: {
				id: "asc",
			},
		});
	}

	async delete(id: number) {
		return prisma.user.delete({
			where: {
				id,
			},
			omit: {
				passwordHash: true,
			},
		});
	}
}

export const userRepository = new UserRepository();