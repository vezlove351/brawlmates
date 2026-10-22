// Всё общение с Brawl Stars API. Только на сервере: ключ привязан к IP.

// Символы, из которых состоят теги игроков в Brawl Stars.
const TAG_PATTERN = /^#[0289PYLQGRJCUV]{3,14}$/;

// Приводит тег к виду "#ABC123": верхний регистр, без пробелов, O → 0.
export function normalizeTag(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "").replace(/O/g, "0");
  return cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
}

export function isValidTag(tag: string): boolean {
  return TAG_PATTERN.test(tag);
}

// Базовые иконки профиля — есть у каждого игрока с самого начала.
export const BASIC_ICON_IDS = [28000000, 28000001, 28000002] as const;

export function iconUrl(iconId: number): string {
  return `/icons/${iconId}.png`;
}

export interface Player {
  tag: string;
  name: string;
  icon: { id: number };
  trophies: number;
}

// Ошибка с сообщением, которое можно показать игроку.
export class BrawlStarsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function friendlyMessage(status: number): string {
  switch (status) {
    case 404:
      return "Игрок с таким тегом не найден. Проверь тег.";
    case 429:
      return "Слишком много запросов. Подожди минутку и попробуй снова.";
    case 503:
      return "В Brawl Stars сейчас техработы. Попробуй позже.";
    default:
      return "Не удалось связаться с Brawl Stars. Попробуй позже.";
  }
}

// Загружает игрока по тегу. Без кеша: при подтверждении иконки нужны свежие данные.
export async function getPlayer(tag: string): Promise<Player> {
  const baseUrl = process.env.BS_API_BASE_URL;
  const token = process.env.BS_API_TOKEN;
  if (!baseUrl || !token) throw new Error("Не заданы BS_API_BASE_URL или BS_API_TOKEN");

  let res: Response;
  try {
    // encodeURIComponent превращает "#" в "%23", как требует API.
    res = await fetch(`${baseUrl}/players/${encodeURIComponent(tag)}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new BrawlStarsError(friendlyMessage(0), 502);
  }

  if (!res.ok) {
    // 403 обычно значит, что ключ не подходит к IP сервера. Логируем без секретов.
    if (res.status === 403) console.error("Brawl Stars API: 403 — проверь IP в ключе");
    throw new BrawlStarsError(friendlyMessage(res.status), res.status === 404 ? 404 : 502);
  }

  const data = (await res.json()) as Player;
  return { tag: data.tag, name: data.name, icon: { id: data.icon.id }, trophies: data.trophies };
}
