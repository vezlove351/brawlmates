import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { fetchRanking } from "./brawlstars";
import { getDb } from "./db";
import { playerProfiles, rankingsCache, users, type RankingEntry } from "./db/schema";

const CACHE_TTL_MS = 10 * 60 * 1000;

// Мировой рейтинг или рейтинг страны (топ-200). Кеш в базе на 10 минут;
// если API недоступен — отдаём последний сохранённый.
export async function getRanking(key: string): Promise<{ entries: RankingEntry[]; fetchedAt: Date }> {
  const db = getDb();
  const [cached] = await db.select().from(rankingsCache).where(eq(rankingsCache.key, key));
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    return { entries: cached.data, fetchedAt: cached.fetchedAt };
  }

  try {
    const entries = await fetchRanking(key);
    const fetchedAt = new Date();
    await db
      .insert(rankingsCache)
      .values({ key, data: entries, fetchedAt })
      .onConflictDoUpdate({ target: rankingsCache.key, set: { data: entries, fetchedAt } });
    return { entries, fetchedAt };
  } catch (err) {
    if (cached) return { entries: cached.data, fetchedAt: cached.fetchedAt };
    throw err;
  }
}

// Рейтинг игроков Brawlmates — по кешу профилей (его обновляет крон каждые 30 минут).
// Заблокированных модератором не показываем.
export async function getBrawlmatesRanking(meId: number) {
  const db = getDb();
  const trophies = sql<number>`(${playerProfiles.data}->>'trophies')::int`;
  const rows = await db
    .select({ userId: users.id, profile: playerProfiles.data, trophies })
    .from(users)
    .innerJoin(playerProfiles, eq(playerProfiles.tag, users.playerTag))
    .where(and(isNotNull(users.playerTag), isNull(users.bannedAt)))
    .orderBy(desc(trophies));

  const entries: RankingEntry[] = rows.map((r, i) => ({
    rank: i + 1,
    tag: r.profile.tag,
    name: r.profile.name,
    iconId: r.profile.iconId,
    trophies: r.profile.trophies,
    club: r.profile.club?.name ?? null,
  }));
  const myIndex = rows.findIndex((r) => r.userId === meId);

  return {
    // Показываем топ-100, а своё место — всегда, даже если ты ниже.
    entries: entries.slice(0, 100),
    me: myIndex >= 0 ? entries[myIndex] : null,
    total: entries.length,
  };
}

// Теги, которые есть в Brawlmates, — чтобы в мировом рейтинге отметить «наших».
export async function brawlmatesTags(tags: string[]): Promise<Set<string>> {
  if (tags.length === 0) return new Set();
  const rows = await getDb()
    .select({ tag: users.playerTag })
    .from(users)
    .where(inArray(users.playerTag, tags));
  return new Set(rows.map((r) => r.tag!).filter(Boolean));
}
