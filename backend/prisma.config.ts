import "dotenv/config";
import { defineConfig } from "prisma/config";

const fallbackDatabaseUrl = "postgresql://postgres:postgres@localhost:5432/transcendence";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `prisma generate` during image build must not crash when DATABASE_URL is
    // only provided at runtime by Compose.
    url: process.env.DATABASE_URL ?? fallbackDatabaseUrl,
  },
});
