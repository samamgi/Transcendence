import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { prisma } from "./lib/prisma.js";
import { sessionMiddleware } from "./config/session.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import friendRoutes from "./routes/friend.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import { errorHandler } from "./middlewares/error-handler.middleware.js";
import { initializeSocket } from "./socket/index.js";

const app = express();

const port = Number(process.env.PORT) || 3000;

app.use(express.json());

app.use(
	"/uploads",
	express.static(path.resolve("uploads")),
);
app.use(sessionMiddleware);

app.get("/health", (_request, response) => {
	response.status(200).json({
		status: "ok",
		service: "backend",
	});
});

app.get("/health/database", async (_request, response) => {
	try {
		await prisma.$queryRaw`SELECT 1`;

		response.status(200).json({
			status: "ok",
			service: "database",
		});
	} catch (error) {
		console.error("Database health check failed:", error);

		response.status(503).json({
			status: "error",
			service: "database",
		});
	}
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/conversations", conversationRoutes);

app.use((_request, response) => {
	response.status(404).json({
		error: "Route not found",
	});
});

app.use(errorHandler);

const httpServer = createServer(app);

initializeSocket(httpServer);

httpServer.listen(port, () => {
	console.log(`Backend running on http://localhost:${port}`);
});