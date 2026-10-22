import { validateInitData, type TelegramUser } from "./telegram-auth";

// Достаёт и проверяет initData из заголовка "Authorization: tma <initData>".
// Возвращает пользователя Telegram или готовый ответ 401.
export function authenticate(request: Request): TelegramUser | Response {
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
  return result.user;
}
