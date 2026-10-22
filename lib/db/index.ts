import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let db: NeonHttpDatabase<typeof schema> | undefined;

// Подключение создаётся при первом запросе, а не при сборке.
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Не задана переменная окружения DATABASE_URL");
  db = drizzle(neon(url), { schema });
  return db;
}
