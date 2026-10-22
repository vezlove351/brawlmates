import { asc, desc, eq, gte, and } from "drizzle-orm";
import { fetchBattleLog } from "./brawlstars";
import { getDb } from "./db";
import { battles, trophyHistory } from "./db/schema";
import { getPlayerProfile } from "./profile";

// День по UTC в виде "2026-10-22".
function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Сохраняет новые бои игрока и сегодняшнее число трофеев.
// Вызывается кроном каждые 30 минут и сразу после привязки тега.
export async function syncPlayer(tag: string): Promise<{ newBattles: number }> {
  const db = getDb();

  const log = await fetchBattleLog(tag);
  let newBattles = 0;
  if (log.length > 0) {
    // Уже сохранённые бои (тот же тег + то же время) база просто пропустит.
    const inserted = await db
      .insert(battles)
      .values(log.map((b) => ({ ...b, playerTag: tag })))
      .onConflictDoNothing({ target: [battles.playerTag, battles.battleTime] })
      .returning({ id: battles.id });
    newBattles = inserted.length;
  }

  // Точка для графика: трофеи на сегодня (перезаписываем в течение дня).
  const { profile } = await getPlayerProfile(tag);
  const day = utcDay(new Date());
  await db
    .insert(trophyHistory)
    .values({ playerTag: tag, day, trophies: profile.trophies })
    .onConflictDoUpdate({
      target: [trophyHistory.playerTag, trophyHistory.day],
      set: { trophies: profile.trophies },
    });

  return { newBattles };
}

const HISTORY_DAYS = 30;
const BATTLES_LIMIT = 30;

// Данные для вкладки «Бои».
export async function getBattlesView(tag: string) {
  const db = getDb();

  const recent = await db
    .select()
    .from(battles)
    .where(eq(battles.playerTag, tag))
    .orderBy(desc(battles.battleTime))
    .limit(BATTLES_LIMIT);

  const since = utcDay(new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000));
  const history = await db
    .select({ day: trophyHistory.day, trophies: trophyHistory.trophies })
    .from(trophyHistory)
    .where(and(eq(trophyHistory.playerTag, tag), gte(trophyHistory.day, since)))
    .orderBy(asc(trophyHistory.day));

  // С какого дня мы следим за игроком — чтобы честно об этом сказать.
  const [first] = await db
    .select({ day: trophyHistory.day })
    .from(trophyHistory)
    .where(eq(trophyHistory.playerTag, tag))
    .orderBy(asc(trophyHistory.day))
    .limit(1);

  return {
    battles: recent.map((b) => ({
      battleTime: b.battleTime.toISOString(),
      mode: b.mode,
      map: b.map,
      result: b.result,
      rank: b.rank,
      trophyChange: b.trophyChange,
      brawlerId: b.brawlerId,
    })),
    history,
    trackingSince: first?.day ?? null,
  };
}

export type BattlesView = Awaited<ReturnType<typeof getBattlesView>>;
