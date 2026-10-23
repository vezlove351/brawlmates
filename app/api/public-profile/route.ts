import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth";
import { isValidTag, normalizeTag } from "@/lib/brawlstars";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { areFriends } from "@/lib/friends-server";
import { profileResponse } from "@/lib/profile";

// Чужой профиль по ссылке — только просмотр.
// Показываем только игровые данные и только тех, кто сам привязал аккаунт в Brawlmates.
export async function POST(request: Request): Promise<Response> {
  // Смотреть профили можно только изнутри Telegram.
  const tgUser = authenticate(request);
  if (tgUser instanceof Response) return tgUser;

  const body = (await request.json().catch(() => null)) as { tag?: unknown } | null;
  const tag = normalizeTag(typeof body?.tag === "string" ? body.tag : "");
  if (!isValidTag(tag)) {
    return Response.json({ error: "Неправильная ссылка на профиль" }, { status: 400 });
  }

  const [owner] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.playerTag, tag));
  if (!owner) {
    return Response.json(
      { error: `Игрок ${tag} ещё не пользуется Brawlmates` },
      { status: 404 },
    );
  }

  // Друг видит полный профиль (с боями и графиком), остальные — только карточку.
  // Проверка здесь, на сервере; сами бои отдаёт /api/battles — с той же проверкой.
  const full = await areFriends(tgUser.id, owner.id);
  return profileResponse(tag, { full });
}
