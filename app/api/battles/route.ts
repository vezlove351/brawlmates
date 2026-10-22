import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth";
import { getBattlesView } from "@/lib/battles";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

// Последние бои и график трофеев привязанного игрока (из нашей базы, без запросов к API).
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

  return Response.json(await getBattlesView(user.playerTag));
}
