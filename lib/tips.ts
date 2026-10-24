import { and, count, desc, eq, gt, inArray, isNull, notExists, sql } from "drizzle-orm";
import {
  fetchBrawlerCatalog,
  fetchRotationMaps,
  type CatalogBrawler,
} from "./brawlstars";
import { getDb } from "./db";
import { apiCache, battles, hiddenUsers, playerProfiles, tips, tipVotes, users } from "./db/schema";
import { LfgError } from "./lfg-server";
import { modeName } from "./modes";
import { checkComment } from "./moderation";

export const TIP_TEXT_MAX = 200;
export const TIP_TEXT_MIN = 10;
export const TIPS_PER_DAY = 5;

// Режимы, для которых можно писать советы.
export const TIP_MODES = [
  "gemGrab", "brawlBall", "heist", "bounty", "knockout", "hotZone",
  "wipeout", "soloShowdown", "duoShowdown", "basketBrawl",
];

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());

// --- Кеш справочников в базе ---

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const db = getDb();
  const [row] = await db.select().from(apiCache).where(eq(apiCache.key, key));
  if (row && Date.now() - row.fetchedAt.getTime() < ttlMs) return row.data as T;
  try {
    const data = await load();
    const fetchedAt = new Date();
    await db
      .insert(apiCache)
      .values({ key, data, fetchedAt })
      .onConflictDoUpdate({ target: apiCache.key, set: { data, fetchedAt } });
    return data;
  } catch (err) {
    if (row) return row.data as T; // API недоступен — отдаём старые данные
    throw err;
  }
}

export const getBrawlerCatalog = () => cached("brawlers", 24 * 60 * 60 * 1000, fetchBrawlerCatalog);
const getRotation = () => cached("rotation", 60 * 60 * 1000, fetchRotationMaps);

// Карты по режимам: текущая ротация + карты из сохранённых боёв.
async function mapsByMode(): Promise<Record<string, string[]>> {
  const [rotation, seen] = await Promise.all([
    getRotation().catch(() => []),
    getDb()
      .selectDistinct({ mode: battles.mode, map: battles.map })
      .from(battles)
      .where(and(inArray(battles.mode, TIP_MODES), sql`${battles.map} is not null`)),
  ]);
  const result: Record<string, Set<string>> = {};
  for (const { mode, map } of [...rotation, ...seen]) {
    if (!map || !TIP_MODES.includes(mode)) continue;
    (result[mode] ??= new Set()).add(map);
  }
  return Object.fromEntries(Object.entries(result).map(([m, set]) => [m, [...set].sort()]));
}

// Справочник для формы: бравлеры (свои — отдельно), режимы, карты.
export async function getTipsCatalog(userId: number) {
  const db = getDb();
  const [me] = await db
    .select({ profile: playerProfiles.data })
    .from(users)
    .leftJoin(playerProfiles, eq(playerProfiles.tag, users.playerTag))
    .where(eq(users.id, userId));
  const [catalog, maps] = await Promise.all([getBrawlerCatalog(), mapsByMode()]);
  return {
    brawlers: catalog.map((b) => ({
      id: b.id,
      name: titleCase(b.name),
      gadgets: b.gadgets.map((g) => ({ id: g.id, name: titleCase(g.name) })),
      starPowers: b.starPowers.map((s) => ({ id: s.id, name: titleCase(s.name) })),
      gears: b.gears.map((g) => ({ id: g.id, name: titleCase(g.name) })),
    })),
    myBrawlerIds: (me?.profile?.brawlers ?? []).map((b) => b.id),
    modes: TIP_MODES.map((id) => ({ id, label: modeName(id) })),
    mapsByMode: maps,
  };
}

// --- Создание ---

export interface TipInput {
  brawlerId: unknown;
  mode: unknown;
  map: unknown;
  gadgetId: unknown;
  starPowerId: unknown;
  gearId: unknown;
  text: unknown;
}

// Решение о статусе нового совета принимает createTip (премодерация — задача 10).
export async function createTip(userId: number, input: TipInput, decideStatus: (authorId: number) => Promise<"pending" | "published">) {
  const db = getDb();
  const [me] = await db
    .select({ tag: users.playerTag, bannedAt: users.bannedAt, profile: playerProfiles.data })
    .from(users)
    .leftJoin(playerProfiles, eq(playerProfiles.tag, users.playerTag))
    .where(eq(users.id, userId));
  if (!me?.tag) throw new LfgError("Сначала привяжи аккаунт Brawl Stars", 400);
  if (me.bannedAt) throw new LfgError("Аккаунт заблокирован модератором", 403);

  const catalog = await getBrawlerCatalog();
  const brawler = catalog.find((b) => b.id === Number(input.brawlerId));
  if (!brawler) throw new LfgError("Выбери бравлера из списка", 400);
  // Советовать можно только про своего бравлера — тогда трофеи автора что-то значат.
  if (!(me.profile?.brawlers ?? []).some((b) => b.id === brawler.id)) {
    throw new LfgError("Можно советовать только по своим бравлерам", 400);
  }

  const optionalId = (raw: unknown, list: { id: number }[], what: string) => {
    if (raw === null || raw === undefined || raw === "") return null;
    const id = Number(raw);
    if (!list.some((x) => x.id === id)) throw new LfgError(`Выбери ${what} из списка`, 400);
    return id;
  };
  const gadgetId = optionalId(input.gadgetId, brawler.gadgets, "гаджет");
  const starPowerId = optionalId(input.starPowerId, brawler.starPowers, "звёздную силу");
  const gearId = optionalId(input.gearId, brawler.gears, "снаряжение");

  const mode = typeof input.mode === "string" && input.mode ? input.mode : null;
  if (mode && !TIP_MODES.includes(mode)) throw new LfgError("Выбери режим из списка", 400);
  const map = typeof input.map === "string" && input.map ? input.map : null;
  if (map) {
    if (!mode) throw new LfgError("Сначала выбери режим", 400);
    if (!((await mapsByMode())[mode] ?? []).includes(map)) throw new LfgError("Выбери карту из списка", 400);
  }

  const text = typeof input.text === "string" ? input.text.trim().replace(/\s+/g, " ") : "";
  if (text.length < TIP_TEXT_MIN || text.length > TIP_TEXT_MAX) {
    throw new LfgError(`Текст совета — от ${TIP_TEXT_MIN} до ${TIP_TEXT_MAX} символов`, 400);
  }
  const check = checkComment(text);
  if (!check.ok) throw new LfgError(check.reason.replace("комментарии", "совете"), 400);

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [today] = await db
    .select({ n: count() })
    .from(tips)
    .where(and(eq(tips.authorId, userId), gt(tips.createdAt, dayAgo)));
  if ((today?.n ?? 0) >= TIPS_PER_DAY) throw new LfgError(`Не больше ${TIPS_PER_DAY} советов в сутки`, 429);

  const status = await decideStatus(userId);
  const [tip] = await db
    .insert(tips)
    .values({ authorId: userId, brawlerId: brawler.id, mode, map, gadgetId, starPowerId, gearId, text, status })
    .returning({ id: tips.id, status: tips.status });
  return tip;
}

// --- Лента ---

export interface TipsFilters {
  brawlerId?: number;
  mode?: string;
  sort: "useful" | "new";
}

// Опубликованные советы (без авторов, которых я скрыл, и без заблокированных),
// плюс мои советы на проверке — чтобы автор видел, что совет ждёт модератора.
export async function getTipsFeed(userId: number, filters: TipsFilters) {
  const db = getDb();
  const conditions = [
    sql`(${tips.status} = 'published' or (${tips.authorId} = ${userId} and ${tips.status} = 'pending'))`,
    isNull(users.bannedAt),
    notExists(
      db
        .select({ one: sql`1` })
        .from(hiddenUsers)
        .where(and(eq(hiddenUsers.userId, userId), eq(hiddenUsers.hiddenUserId, tips.authorId))),
    ),
  ];
  if (filters.brawlerId) conditions.push(eq(tips.brawlerId, filters.brawlerId));
  if (filters.mode) conditions.push(eq(tips.mode, filters.mode));

  const rows = await db
    .select({
      tip: tips,
      author: playerProfiles.data,
      votedByMe: sql<boolean>`exists (select 1 from ${tipVotes} where ${tipVotes.tipId} = ${tips.id} and ${tipVotes.userId} = ${userId})`,
    })
    .from(tips)
    .innerJoin(users, eq(users.id, tips.authorId))
    .leftJoin(playerProfiles, eq(playerProfiles.tag, users.playerTag))
    .where(and(...conditions))
    .orderBy(...(filters.sort === "useful" ? [desc(tips.usefulCount), desc(tips.createdAt)] : [desc(tips.createdAt)]))
    .limit(50);

  const catalog = await getBrawlerCatalog();
  return rows.map(({ tip, author, votedByMe }) => toTipCard(tip, author, catalog, userId, votedByMe));
}

type TipRow = typeof tips.$inferSelect;
type AuthorProfile = typeof playerProfiles.$inferSelect["data"] | null;

// Совет в том виде, в каком его видит браузер: с названиями и трофеями автора на бравлере.
export function toTipCard(tip: TipRow, author: AuthorProfile, catalog: CatalogBrawler[], viewerId: number, votedByMe: boolean) {
  const brawler = catalog.find((b) => b.id === tip.brawlerId);
  const nameOf = (list: { id: number; name: string }[] | undefined, id: number | null) =>
    id === null ? null : titleCase(list?.find((x) => x.id === id)?.name ?? "?");
  return {
    id: tip.id,
    brawlerId: tip.brawlerId,
    brawlerName: brawler ? titleCase(brawler.name) : "Бравлер",
    mode: tip.mode,
    modeLabel: tip.mode ? modeName(tip.mode) : null,
    map: tip.map,
    gadget: nameOf(brawler?.gadgets, tip.gadgetId),
    starPower: nameOf(brawler?.starPowers, tip.starPowerId),
    gear: nameOf(brawler?.gears, tip.gearId),
    text: tip.text,
    status: tip.status,
    usefulCount: tip.usefulCount,
    votedByMe,
    isMine: tip.authorId === viewerId,
    author: {
      name: author?.name ?? "Игрок",
      tag: author?.tag ?? null,
      // Трофеи автора на этом бравлере — по ним видно, кому можно доверять.
      brawlerTrophies: author?.brawlers?.find((b) => b.id === tip.brawlerId)?.trophies ?? null,
    },
    createdAt: tip.createdAt.toISOString(),
  };
}

export type TipCard = ReturnType<typeof toTipCard>;

// «Полезно» — один раз на человека; за свой совет голосовать нельзя.
export async function voteUseful(userId: number, tipId: number) {
  const db = getDb();
  const [tip] = await db.select().from(tips).where(eq(tips.id, tipId));
  if (!tip || tip.status !== "published") throw new LfgError("Совет недоступен", 404);
  if (tip.authorId === userId) throw new LfgError("За свой совет голосовать нельзя", 400);

  const inserted = await db.insert(tipVotes).values({ tipId, userId }).onConflictDoNothing().returning({ tipId: tipVotes.tipId });
  if (inserted.length === 0) return { usefulCount: tip.usefulCount, already: true };
  const [updated] = await db
    .update(tips)
    .set({ usefulCount: sql`${tips.usefulCount} + 1` })
    .where(eq(tips.id, tipId))
    .returning({ usefulCount: tips.usefulCount });
  return { usefulCount: updated.usefulCount, already: false };
}
