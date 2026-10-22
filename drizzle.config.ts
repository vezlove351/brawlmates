import { defineConfig } from "drizzle-kit";

// Локально берём адрес базы из .env.local (его создаёт `vercel env pull`).
try {
  process.loadEnvFile(".env.local");
} catch {
  // Файла нет — значит, переменные уже заданы окружением.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Для миграций нужно прямое подключение, без пула.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
