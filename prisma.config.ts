import path from "node:path";
import { loadEnvFile } from "node:process";
import { defineConfig, env } from "prisma/config";

try {
  loadEnvFile(path.join(__dirname, ".env"));
} catch {
  // .env is optional (e.g. when DATABASE_URL is already set in the environment)
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: path.join("prisma", "migrations"),
  },
});
