import { createHmac, timingSafeEqual } from "node:crypto";

// Проверка initData — данных, которые Telegram передаёт мини-приложению при открытии.
// Telegram подписывает их токеном бота. Токен знает только наш сервер, поэтому
// подделать подпись (или поменять хоть один символ в данных) нельзя.
// Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export type InitDataResult =
  | { ok: true; user: TelegramUser; authDate: Date }
  | { ok: false; reason: string };

// Данные старше суток не принимаем — чтобы украденную старую строку нельзя было
// использовать вечно.
const MAX_AGE_SECONDS = 24 * 60 * 60;

export function validateInitData(
  raw: string,
  botToken: string,
  now: Date = new Date(),
): InitDataResult {
  const params = new URLSearchParams(raw);

  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "нет подписи (hash)" };
  params.delete("hash");

  // Строка для проверки: все поля, кроме hash, по алфавиту, через перевод строки.
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  // Ключ = HMAC-SHA256("WebAppData", токен бота); подпись = HMAC-SHA256(ключ, строка).
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const received = Buffer.from(hash, "hex");

  // timingSafeEqual сравнивает за одинаковое время — так по скорости ответа
  // нельзя угадывать подпись по одному символу.
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: "неверная подпись" };
  }

  const authDateSeconds = Number(params.get("auth_date"));
  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) {
    return { ok: false, reason: "нет даты входа (auth_date)" };
  }
  const ageSeconds = now.getTime() / 1000 - authDateSeconds;
  if (ageSeconds > MAX_AGE_SECONDS) return { ok: false, reason: "данные устарели" };
  if (ageSeconds < -60) return { ok: false, reason: "дата входа из будущего" };

  const user = parseUser(params.get("user"));
  if (!user) return { ok: false, reason: "нет данных пользователя" };

  return { ok: true, user, authDate: new Date(authDateSeconds * 1000) };
}

function parseUser(json: string | null): TelegramUser | null {
  if (!json) return null;
  try {
    const value: unknown = JSON.parse(json);
    if (
      typeof value === "object" &&
      value !== null &&
      "id" in value &&
      typeof value.id === "number" &&
      "first_name" in value &&
      typeof value.first_name === "string"
    ) {
      return value as TelegramUser;
    }
  } catch {
    // Некорректный JSON — считаем, что пользователя нет.
  }
  return null;
}
