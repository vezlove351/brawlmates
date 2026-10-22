import { eq } from "drizzle-orm";
import { BrawlStarsError, fetchPlayerProfile, type PlayerProfile } from "./brawlstars";
import { getDb } from "./db";
import { playerProfiles } from "./db/schema";

// Сколько живёт кеш профиля.
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface CachedProfile {
  profile: PlayerProfile;
  fetchedAt: Date;
  // true — API недоступен, показываем последние сохранённые данные.
  stale: boolean;
}

// Профиль игрока: из кеша в базе, если ему меньше 5 минут, иначе — свежий из API.
export async function getPlayerProfile(tag: string): Promise<CachedProfile> {
  const db = getDb();
  const [cached] = await db.select().from(playerProfiles).where(eq(playerProfiles.tag, tag));

  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    return { profile: cached.data, fetchedAt: cached.fetchedAt, stale: false };
  }

  try {
    const profile = await fetchPlayerProfile(tag);
    const fetchedAt = new Date();
    await db
      .insert(playerProfiles)
      .values({ tag, data: profile, fetchedAt })
      .onConflictDoUpdate({ target: playerProfiles.tag, set: { data: profile, fetchedAt } });
    return { profile, fetchedAt, stale: false };
  } catch (err) {
    // API лёг (техработы, лимит) — лучше показать старые данные, чем ошибку.
    if (cached && err instanceof BrawlStarsError && err.status !== 404) {
      return { profile: cached.data, fetchedAt: cached.fetchedAt, stale: true };
    }
    throw err;
  }
}
