import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth";
import { BrawlStarsError } from "@/lib/brawlstars";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getPlayerProfile } from "@/lib/profile";

// Профиль привязанного игрока для карточки.
export async function POST(request: Request): Promise<Response> {
  const tgUser = authenticate(request);
  if (tgUser instanceof Response) return tgUser;

  const [user] = await getDb()
    .select({ playerTag: users.playerTag })
    .from(users)
    .where(eq(users.id, tgUser.id));
  if (!user?.playerTag) {
    return Response.json({ error: "Аккаунт Brawl Stars не привязан" }, { status: 404 });
  }

  try {
    const { profile, fetchedAt, stale } = await getPlayerProfile(user.playerTag);
    return Response.json({
      profile,
      stale,
      // Считаем на сервере, чтобы клиенту не зависеть от часов телефона.
      updatedMinutesAgo: Math.floor((Date.now() - fetchedAt.getTime()) / 60_000),
    });
  } catch (err) {
    if (err instanceof BrawlStarsError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
