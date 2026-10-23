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

// Картинка любой иконки профиля (с фанатского CDN Brawlify).
export function remoteIconUrl(iconId: number): string {
  return `https://cdn.brawlify.com/profile-icons/regular/${iconId}.png`;
}

// Иконка бравлера (с CDN Brawlify / BrawlAPI).
export function brawlerIconUrl(brawlerId: number): string {
  return `https://cdn.brawlify.com/brawlers/borders/${brawlerId}.png`;
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

// Общий запрос к API. Без кеша Next.js — кешируем сами там, где нужно.
async function apiGet<T>(path: string): Promise<T> {
  const baseUrl = process.env.BS_API_BASE_URL;
  const token = process.env.BS_API_TOKEN;
  if (!baseUrl || !token) throw new Error("Не заданы BS_API_BASE_URL или BS_API_TOKEN");

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
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
  return (await res.json()) as T;
}

// encodeURIComponent превращает "#" в "%23", как требует API.
function playerPath(tag: string): string {
  return `/players/${encodeURIComponent(tag)}`;
}

// --- Короткие данные игрока (для привязки тега) ---

export interface Player {
  tag: string;
  name: string;
  icon: { id: number };
}

export async function getPlayer(tag: string): Promise<Player> {
  const data = await apiGet<Player>(playerPath(tag));
  return { tag: data.tag, name: data.name, icon: { id: data.icon.id } };
}

// --- Профиль для карточки игрока ---

// Так поля называются в ответе API (только те, что нам нужны).
interface ApiPlayer {
  tag: string;
  name: string;
  icon: { id: number };
  trophies: number;
  highestTrophies: number;
  expLevel: number;
  club: { tag?: string; name?: string };
  "3vs3Victories": number;
  soloVictories: number;
  duoVictories: number;
  brawlers: PlayerBrawler[];
}

export interface PlayerBrawler {
  id: number;
  name: string;
  power: number;
  rank: number;
  trophies: number;
  highestTrophies: number;
}

export interface PlayerProfile {
  tag: string;
  name: string;
  iconId: number;
  trophies: number;
  highestTrophies: number;
  expLevel: number;
  club: { tag: string; name: string } | null;
  victories3v3: number;
  victoriesSolo: number;
  victoriesDuo: number;
  brawlers: PlayerBrawler[];
}

export async function fetchPlayerProfile(tag: string): Promise<PlayerProfile> {
  const p = await apiGet<ApiPlayer>(playerPath(tag));
  return {
    tag: p.tag,
    name: p.name,
    iconId: p.icon.id,
    trophies: p.trophies,
    highestTrophies: p.highestTrophies,
    expLevel: p.expLevel,
    // Если игрок не в клубе, API присылает пустой объект {}.
    club: p.club?.tag && p.club.name ? { tag: p.club.tag, name: p.club.name } : null,
    victories3v3: p["3vs3Victories"],
    victoriesSolo: p.soloVictories,
    victoriesDuo: p.duoVictories,
    // Берём только нужные поля — в ответе API их гораздо больше.
    brawlers: p.brawlers.map((b) => ({
      id: b.id,
      name: b.name,
      power: b.power,
      rank: b.rank,
      trophies: b.trophies,
      highestTrophies: b.highestTrophies,
    })),
  };
}

// --- История боёв (battlelog) ---

interface ApiBattlePlayer {
  tag: string;
  brawler?: { id: number };
  // В дуэлях у игрока несколько бравлеров
  brawlers?: { id: number }[];
}

interface ApiBattle {
  battleTime: string;
  event: { mode?: string; map?: string | null };
  battle: {
    mode?: string;
    type?: string;
    result?: string;
    rank?: number;
    trophyChange?: number;
    teams?: ApiBattlePlayer[][];
    players?: ApiBattlePlayer[];
  };
}

export interface Battle {
  battleTime: Date;
  mode: string;
  map: string | null;
  type: string | null;
  result: string | null;
  rank: number | null;
  trophyChange: number | null;
  brawlerId: number | null;
}

// "20261022T130858.000Z" → Date
function parseBattleTime(value: string): Date {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!m) return new Date(Number.NaN);
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
}

// Последние ~25 боёв игрока.
export async function fetchBattleLog(tag: string): Promise<Battle[]> {
  const data = await apiGet<{ items: ApiBattle[] }>(`${playerPath(tag)}/battlelog`);

  return data.items
    .map((item) => {
      const { event, battle } = item;
      // Ищем самого игрока среди участников, чтобы узнать, каким бравлером он играл.
      const everyone = [...(battle.teams?.flat() ?? []), ...(battle.players ?? [])];
      const me = everyone.find((p) => p.tag === tag);
      // event.mode точнее (например, «5 на 5»), но иногда приходит "unknown".
      const mode = event.mode && event.mode !== "unknown" ? event.mode : (battle.mode ?? "unknown");

      return {
        battleTime: parseBattleTime(item.battleTime),
        mode,
        map: event.map ?? null,
        type: battle.type ?? null,
        result: battle.result ?? null,
        rank: battle.rank ?? null,
        trophyChange: battle.trophyChange ?? null,
        brawlerId: me?.brawler?.id ?? me?.brawlers?.[0]?.id ?? null,
      };
    })
    .filter((b) => !Number.isNaN(b.battleTime.getTime()));
}

// --- Рейтинги ---

interface ApiRankingPlayer {
  tag: string;
  name: string;
  icon: { id: number };
  trophies: number;
  rank: number;
  club?: { name?: string };
}

// Топ-200 игроков: key = "global" или код страны ("RU").
export async function fetchRanking(key: string) {
  const data = await apiGet<{ items: ApiRankingPlayer[] }>(
    `/rankings/${encodeURIComponent(key)}/players?limit=200`,
  );
  return data.items.map((p) => ({
    rank: p.rank,
    tag: p.tag,
    name: p.name,
    iconId: p.icon.id,
    trophies: p.trophies,
    club: p.club?.name ?? null,
  }));
}
