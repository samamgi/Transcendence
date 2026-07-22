import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error.js";

export function errorHandler(
	error: unknown,
	_request: Request,
	response: Response,
	_next: NextFunction,
) {
	if (error instanceof HttpError) {
		response.status(error.status).json({
			error: error.message,
		});

		return;
	}

	console.error("Unhandled error:", error);

	response.status(500).json({
		error: "Internal server error",
	});
}
