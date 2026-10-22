import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { validateInitData } from "@/lib/telegram-auth";

// Вход: клиент присылает initData в заголовке "Authorization: tma <initData>".
// Сервер проверяет подпись и создаёт пользователя при первом входе.
export async function POST(request: Request): Promise<Response> {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, initData] = header.split(" ");
  if (scheme !== "tma" || !initData) {
    return Response.json({ error: "Нет данных входа Telegram" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("Не задана переменная окружения TELEGRAM_BOT_TOKEN");

  const result = validateInitData(initData, botToken);
  if (!result.ok) {
    return Response.json({ error: "Данные входа не прошли проверку" }, { status: 401 });
  }

  // Создаём пользователя, а если он уже есть — обновляем имя (его могли поменять в Telegram).
  const [user] = await getDb()
    .insert(users)
    .values({ id: result.user.id, firstName: result.user.first_name })
    .onConflictDoUpdate({ target: users.id, set: { firstName: result.user.first_name } })
    .returning();

  return Response.json({
    user: { firstName: user.firstName, createdAt: user.createdAt.toISOString() },
  });
}
