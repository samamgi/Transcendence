import "dotenv/config";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const sessionSecret = process.env.SESSION_SECRET;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is missing from environment variables");
}

if (!sessionSecret) {
	throw new Error("SESSION_SECRET is missing from environment variables");
}

const PostgreSqlStore = connectPgSimple(session);

const sessionPool = new Pool({
	connectionString: databaseUrl,
});

export const sessionMiddleware = session({
	store: new PostgreSqlStore({
		pool: sessionPool,
		tableName: "session",
		createTableIfMissing: true,
	}),

	name: "transcendence.sid",

	secret: sessionSecret,

	resave: false,
	saveUninitialized: false,

	cookie: {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 1000 * 60 * 60 * 24 * 7,
	},
});