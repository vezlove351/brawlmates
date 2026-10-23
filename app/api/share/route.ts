import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth";
import { getAppUrl, getBot } from "@/lib/bot";
import { BrawlStarsError } from "@/lib/brawlstars";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { formatNumber } from "@/lib/format";
import { profileLink } from "@/lib/links";
import { getPlayerProfile } from "@/lib/profile";

// Готовит сообщение «мой профиль» для окна «переслать в чат» (shareMessage).
// Бот сохраняет сообщение у Telegram и возвращает его id; приложение передаёт id в shareMessage.
export async function POST(request: Request): Promise<Response> {
  const tgUser = authenticate(request);
  if (tgUser instanceof Response) return tgUser;

  const [user] = await getDb()
    .select({ playerTag: users.playerTag })
    .from(users)
    .where(eq(users.id, tgUser.id));
  if (!user?.playerTag) {
    return Response.json({ error: "Сначала привяжи аккаунт Brawl Stars" }, { status: 404 });
  }

  let profile;
  try {
    ({ profile } = await getPlayerProfile(user.playerTag));
  } catch (err) {
    if (err instanceof BrawlStarsError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const link = profileLink(profile.tag);
  const text = `🏆 ${profile.name} — ${formatNumber(profile.trophies)} трофеев. Смотри мой профиль в Brawlmates!`;
  // Меняем адрес картинки раз в 10 минут, чтобы Telegram не показывал старую карточку.
  const version = Math.floor(Date.now() / 600_000);
  const photoUrl = `${getAppUrl()}/api/card/${profile.tag.slice(1)}?format=jpg&v=${version}`;

  const prepared = await getBot().api.savePreparedInlineMessage(
    tgUser.id,
    {
      type: "photo",
      id: `profile-${version}`,
      photo_url: photoUrl,
      thumbnail_url: photoUrl,
      photo_width: 1200,
      photo_height: 630,
      caption: text,
      reply_markup: { inline_keyboard: [[{ text: "Открыть профиль", url: link }]] },
    },
    // Можно переслать людям и в группы; ботам и в каналы — нет.
    { allow_user_chats: true, allow_group_chats: true, allow_bot_chats: false, allow_channel_chats: false },
  );

  return Response.json({ id: prepared.id, link, text });
}
