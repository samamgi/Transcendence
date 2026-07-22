import "dotenv/config";
import express from "express";
import { prisma } from "./lib/prisma.js";
import { sessionMiddleware } from "./config/session.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import { errorHandler } from "./middlewares/error-handler.middleware.js";

const app = express();

const port = Number(process.env.PORT) || 3000;

app.use(express.json());
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

app.use((_request, response) => {
	response.status(404).json({
		error: "Route not found",
	});
});

app.use(errorHandler);

app.listen(port, () => {
	console.log(`Backend running on http://localhost:${port}`);
});