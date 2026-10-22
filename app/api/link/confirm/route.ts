import { eq } from "drizzle-orm";
import { after } from "next/server";
import { authenticate } from "@/lib/auth";
import { syncPlayer } from "@/lib/battles";
import { BrawlStarsError, getPlayer } from "@/lib/brawlstars";
import { getDb } from "@/lib/db";
import { tagLinkRequests, users } from "@/lib/db/schema";

// Шаг 2 привязки: проверяем через API, что игрок поставил нужную иконку.
export async function POST(request: Request): Promise<Response> {
  const tgUser = authenticate(request);
  if (tgUser instanceof Response) return tgUser;

  const db = getDb();
  const [pending] = await db
    .select()
    .from(tagLinkRequests)
    .where(eq(tagLinkRequests.userId, tgUser.id));

  if (!pending || pending.expiresAt < new Date()) {
    return Response.json(
      { error: "Время на проверку вышло. Введи тег ещё раз." },
      { status: 410 },
    );
  }

  let player;
  try {
    player = await getPlayer(pending.playerTag);
  } catch (err) {
    if (err instanceof BrawlStarsError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  if (player.icon.id !== pending.iconId) {
    return Response.json(
      {
        error:
          "Иконка пока не та. Проверь, что выбрал именно её. Если только что поменял — подожди минуту и нажми ещё раз.",
      },
      { status: 409 },
    );
  }

  // Владение доказано. Если этот тег был привязан к кому-то другому — отвязываем,
  // ведь подтвердить смену иконки может только настоящий владелец.
  // batch выполняет все запросы вместе: либо все, либо ни одного.
  await db.batch([
    db.update(users).set({ playerTag: null }).where(eq(users.playerTag, player.tag)),
    db.update(users).set({ playerTag: player.tag }).where(eq(users.id, tgUser.id)),
    db.delete(tagLinkRequests).where(eq(tagLinkRequests.userId, tgUser.id)),
  ]);

  // Сразу сохраняем бои и первую точку графика — уже после ответа, чтобы игрок не ждал.
  const tag = player.tag;
  after(() =>
    syncPlayer(tag).catch((err: unknown) =>
      console.error("Первая синхронизация боёв не удалась:", err instanceof Error ? err.message : err),
    ),
  );

  return Response.json({ player: { tag: player.tag, name: player.name } });
}
