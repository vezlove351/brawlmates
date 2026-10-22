import { authenticate } from "@/lib/auth";
import {
  BASIC_ICON_IDS,
  BrawlStarsError,
  getPlayer,
  iconUrl,
  isValidTag,
  normalizeTag,
} from "@/lib/brawlstars";
import { getDb } from "@/lib/db";
import { tagLinkRequests, users } from "@/lib/db/schema";

// Сколько времени даём игроку, чтобы сменить иконку.
const REQUEST_TTL_MS = 15 * 60 * 1000;

// Шаг 1 привязки: проверяем, что игрок существует, и выбираем иконку,
// которую он должен поставить, чтобы доказать, что аккаунт его.
export async function POST(request: Request): Promise<Response> {
  const tgUser = authenticate(request);
  if (tgUser instanceof Response) return tgUser;

  const body = (await request.json().catch(() => null)) as { tag?: unknown } | null;
  const tag = normalizeTag(typeof body?.tag === "string" ? body.tag : "");
  if (!isValidTag(tag)) {
    return Response.json(
      { error: "Тег выглядит неправильно. Он начинается с # и состоит из букв и цифр." },
      { status: 400 },
    );
  }

  let player;
  try {
    player = await getPlayer(tag);
  } catch (err) {
    if (err instanceof BrawlStarsError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  // Просим иконку, которая отличается от текущей, — иначе проверка ничего не докажет.
  const choices = BASIC_ICON_IDS.filter((id) => id !== player.icon.id);
  const iconId = choices[Math.floor(Math.random() * choices.length)];
  const expiresAt = new Date(Date.now() + REQUEST_TTL_MS);

  const db = getDb();
  // На всякий случай создаём пользователя, если вход ещё не записал его.
  await db
    .insert(users)
    .values({ id: tgUser.id, firstName: tgUser.first_name })
    .onConflictDoNothing();
  await db
    .insert(tagLinkRequests)
    .values({ userId: tgUser.id, playerTag: player.tag, iconId, expiresAt })
    .onConflictDoUpdate({
      target: tagLinkRequests.userId,
      set: { playerTag: player.tag, iconId, expiresAt },
    });

  return Response.json({
    player: { tag: player.tag, name: player.name },
    icon: { id: iconId, url: iconUrl(iconId) },
    expiresAt: expiresAt.toISOString(),
  });
}
