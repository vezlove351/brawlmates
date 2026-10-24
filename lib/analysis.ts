import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { battles, playerProfiles, users } from "./db/schema";
import { LfgError } from "./lfg-server";
import { modeName } from "./modes";

// «Мой разбор»: личная аналитика по сохранённым боям. Только факты из данных.

type Outcome = "win" | "loss" | null; // null — ничья или непонятный итог (не считаем)

// Что считаем победой:
// бои 3 на 3 — победа/поражение (ничьи не считаем);
// «Столкновение» — верхняя половина таблицы: одиночное — места 1–4, парное/тройное — 1–2.
function outcomeOf(b: { result: string | null; rank: number | null; mode: string }): Outcome {
  if (b.result === "victory") return "win";
  if (b.result === "defeat") return "loss";
  if (b.result === "draw") return null;
  if (b.rank !== null) {
    const top = b.mode.toLowerCase() === "soloshowdown" ? 4 : 2;
    return b.rank <= top ? "win" : "loss";
  }
  return null;
}

interface Stat {
  key: string;
  label: string;
  games: number;
  wins: number;
  rate: number; // 0..100
}

function group(items: { key: string; label: string; win: boolean }[]): Stat[] {
  const map = new Map<string, Stat>();
  for (const i of items) {
    const s = map.get(i.key) ?? { key: i.key, label: i.label, games: 0, wins: 0, rate: 0 };
    s.games++;
    if (i.win) s.wins++;
    map.set(i.key, s);
  }
  return [...map.values()]
    .map((s) => ({ ...s, rate: Math.round((s.wins / s.games) * 100) }))
    .sort((a, b) => b.games - a.games || b.rate - a.rate);
}

const PERIODS = [
  { key: "night", label: "Ночью (0–6)", from: 0 },
  { key: "morning", label: "Утром (6–12)", from: 6 },
  { key: "day", label: "Днём (12–18)", from: 12 },
  { key: "evening", label: "Вечером (18–24)", from: 18 },
];

function periodOf(date: Date, timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(date),
  );
  return [...PERIODS].reverse().find((p) => hour >= p.from)!;
}

const titleCase = (name: string) => name.toLowerCase().replace(/(^|[\s-])\S/g, (s) => s.toUpperCase());

// Для честного совета у обеих сторон должно быть хотя бы столько боёв…
export const TIP_MIN_GAMES = 5;
// …и разница в проценте побед — не меньше стольких пунктов.
const TIP_MIN_DIFF = 15;

// Совет вида «На карте X ты выигрываешь в 70% боёв, а на Z — в 40%».
function tipFrom(stats: Stat[], phrase: (best: Stat, worst: Stat) => string): string | null {
  const solid = stats.filter((s) => s.games >= TIP_MIN_GAMES);
  if (solid.length < 2) return null;
  const sorted = [...solid].sort((a, b) => b.rate - a.rate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  if (best.rate - worst.rate < TIP_MIN_DIFF) return null;
  return phrase(best, worst);
}

export async function getAnalysis(userId: number) {
  const db = getDb();
  const [user] = await db
    .select({ tag: users.playerTag, timeZone: users.timeZone })
    .from(users)
    .where(eq(users.id, userId));
  if (!user?.tag) throw new LfgError("Сначала привяжи аккаунт Brawl Stars", 400);
  const timeZone = user.timeZone ?? "UTC";

  const [profileRow] = await db
    .select({ data: playerProfiles.data })
    .from(playerProfiles)
    .where(eq(playerProfiles.tag, user.tag));
  const brawlerName = new Map((profileRow?.data.brawlers ?? []).map((b) => [b.id, titleCase(b.name)]));

  const rows = await db
    .select()
    .from(battles)
    .where(eq(battles.playerTag, user.tag))
    .orderBy(desc(battles.battleTime))
    .limit(2000);

  // Только бои с понятным итогом.
  const decided = rows
    .map((b) => ({ ...b, outcome: outcomeOf(b) }))
    .filter((b): b is typeof b & { outcome: "win" | "loss" } => b.outcome !== null);

  const total = decided.length;
  const wins = decided.filter((b) => b.outcome === "win").length;
  const since = rows.length > 0 ? rows[rows.length - 1].battleTime.toISOString() : null;

  const byBrawler = group(
    decided
      .filter((b) => b.brawlerId !== null)
      .map((b) => ({
        key: String(b.brawlerId),
        label: brawlerName.get(b.brawlerId!) ?? `Бравлер ${b.brawlerId}`,
        win: b.outcome === "win",
      })),
  );
  const byMode = group(decided.map((b) => ({ key: b.mode, label: modeName(b.mode), win: b.outcome === "win" })));
  const byMap = group(
    decided
      .filter((b) => b.map)
      .map((b) => ({ key: `${b.mode}|${b.map}`, label: b.map!, win: b.outcome === "win" })),
  );
  const byPeriod = group(
    decided.map((b) => {
      const p = periodOf(b.battleTime, timeZone);
      return { key: p.key, label: p.label, win: b.outcome === "win" };
    }),
  ).sort((a, b) => PERIODS.findIndex((p) => p.key === a.key) - PERIODS.findIndex((p) => p.key === b.key));

  // Серии — по времени, от старых к новым.
  let longestWin = 0;
  let longestLoss = 0;
  let run = 0;
  let runType: "win" | "loss" | null = null;
  for (const b of [...decided].reverse()) {
    run = b.outcome === runType ? run + 1 : 1;
    runType = b.outcome;
    if (runType === "win") longestWin = Math.max(longestWin, run);
    else longestLoss = Math.max(longestLoss, run);
  }
  const current = runType ? { type: runType, length: run } : null;

  // Советы: только сравнения с достаточным числом боёв и заметной разницей.
  const tips = [
    tipFrom(byMap, (b, w) => `На карте «${b.label}» ты выигрываешь в ${b.rate}% боёв, а на «${w.label}» — только в ${w.rate}%.`),
    tipFrom(byBrawler, (b, w) => `За ${b.label} ты выигрываешь в ${b.rate}% боёв, а за ${w.label} — в ${w.rate}%.`),
    tipFrom(byMode, (b, w) => `В режиме «${b.label}» у тебя ${b.rate}% побед, а в «${w.label}» — ${w.rate}%.`),
    tipFrom(byPeriod, (b, w) => `${b.label.split(" ")[0]} ты выигрываешь чаще (${b.rate}%), чем ${w.label.split(" ")[0].toLowerCase()} (${w.rate}%).`),
  ].filter((t): t is string => t !== null).slice(0, 3);

  return {
    total,
    wins,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    since,
    timeZone: user.timeZone,
    byBrawler: byBrawler.slice(0, 10),
    byMode,
    byMap: byMap.slice(0, 10),
    byPeriod,
    streaks: { longestWin, longestLoss, current },
    tips,
    tipMinGames: TIP_MIN_GAMES,
  };
}

export type Analysis = Awaited<ReturnType<typeof getAnalysis>>;
