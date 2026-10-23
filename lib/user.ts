import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "./db/schema";

// Привязанный тег пользователя (или null).
export async function getUserTag(userId: number): Promise<string | null> {
  const [row] = await getDb().select({ tag: users.playerTag }).from(users).where(eq(users.id, userId));
  return row?.tag ?? null;
}
