import crypto from "node:crypto";
import path from "node:path";
import multer from "multer";
import { HttpError } from "../lib/http-error.js";

const storage = multer.diskStorage({
	destination(_request, _file, callback) {
		callback(null, "uploads/avatars");
	},

	filename(_request, file, callback) {
		const extension = path.extname(file.originalname).toLowerCase();

		const filename =
			crypto.randomUUID() + extension;

		callback(null, filename);
	},
});

const allowedMimeTypes = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
]);

function fileFilter(
	_request: Express.Request,
	file: Express.Multer.File,
	callback: multer.FileFilterCallback,
) {
	if (!allowedMimeTypes.has(file.mimetype)) {
		callback(
			new HttpError(
				400,
				"Only JPEG, PNG and WEBP images are allowed",
			),
		);

		return;
	}

	callback(null, true);
}

export const avatarUpload = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: 2 * 1024 * 1024,
		files: 1,
	},
});
