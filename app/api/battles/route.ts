import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth";
import { getBattlesView } from "@/lib/battles";
import { isValidTag, normalizeTag } from "@/lib/brawlstars";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { areFriends, userIdByTag } from "@/lib/friends-server";

// Последние бои и график трофеев (из нашей базы, без запросов к API).
// Без тега — свои; с тегом — друга. Бои не-друзей не отдаём никогда.
export async function POST(request: Request): Promise<Response> {
  const tgUser = authenticate(request);
  if (tgUser instanceof Response) return tgUser;

  const body = (await request.json().catch(() => null)) as { tag?: unknown } | null;

  if (typeof body?.tag === "string" && body.tag) {
    const tag = normalizeTag(body.tag);
    const ownerId = isValidTag(tag) ? await userIdByTag(tag) : null;
    if (!ownerId) return Response.json({ error: "Игрок не найден" }, { status: 404 });
    if (ownerId !== tgUser.id && !(await areFriends(tgUser.id, ownerId))) {
      return Response.json({ error: "История боёв видна только друзьям" }, { status: 403 });
    }
    return Response.json(await getBattlesView(tag));
  }

  const [user] = await getDb()
    .select({ playerTag: users.playerTag })
    .from(users)
    .where(eq(users.id, tgUser.id));
  if (!user?.playerTag) {
    return Response.json({ error: "Аккаунт Brawl Stars не привязан" }, { status: 404 });
  }

  return Response.json(await getBattlesView(user.playerTag));
}
