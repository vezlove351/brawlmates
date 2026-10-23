import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "./db";
import { battles, playerProfiles, teamMembers, users } from "./db/schema";
import { LfgError } from "./lfg-server";

// Статистика команды по совместным боям.
// Бой считается совместным, если в составе команды игрока (поле teammates)
// есть другой участник его команды Brawlmates. Соперники не считаются.

interface Bucket {
  games: number;
  wins: number;
}

const add = (map: Map<string, Bucket>, key: string, win: boolean) => {
  const b = map.get(key) ?? { games: 0, wins: 0 };
  b.games++;
  if (win) b.wins++;
  map.set(key, b);
};

// Лучшие сначала: по проценту побед, при равенстве — по числу игр.
// Если игр хотя бы по 2 мало — показываем просто самые частые.
function best<T extends Bucket>(items: T[], limit: number): T[] {
  const rate = (b: Bucket) => b.wins / b.games;
  const solid = items.filter((i) => i.games >= 2);
  const pool = solid.length > 0 ? solid : items;
  return [...pool].sort((a, b) => rate(b) - rate(a) || b.games - a.games).slice(0, limit);
}

export async function getTeamStats(userId: number) {
  const db = getDb();
  const [me] = await db.select({ teamId: teamMembers.teamId }).from(teamMembers).where(eq(teamMembers.userId, userId));
  if (!me) throw new LfgError("Ты не в команде", 404);

  const members = await db
    .select({ tag: users.playerTag, profile: playerProfiles.data })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.tag, users.playerTag))
    .where(eq(teamMembers.teamId, me.teamId));
  const tags = members.map((m) => m.tag).filter((t): t is string => Boolean(t));

  // Имена бравлеров — из профилей участников.
  const brawlerNames = new Map<number, string>();
  for (const m of members) for (const b of m.profile?.brawlers ?? []) brawlerNames.set(b.id, b.name);

  if (tags.length < 2) return { members: tags.length, together: 0 };

  const rows = await db
    .select()
    .from(battles)
    .where(and(inArray(battles.playerTag, tags), isNotNull(battles.teammates)))
    .orderBy(asc(battles.battleTime));

  // Собираем матчи: время боя → кто из команды в нём был вместе и чем играл.
  const matches = new Map<string, { row: (typeof rows)[number]; brawlers: Map<string, number | null> }>();
  for (const row of rows) {
    const together = (row.teammates ?? []).filter((t) => tags.includes(t));
    if (together.length === 0) continue; // играл без команды или против неё
    const key = row.battleTime.toISOString();
    const match = matches.get(key) ?? { row, brawlers: new Map<string, number | null>() };
    match.brawlers.set(row.playerTag, row.brawlerId);
    matches.set(key, match);
  }

  const modes = new Map<string, Bucket>();
  const maps = new Map<string, Bucket>();
  const combos = new Map<string, Bucket>();
  let wins = 0;

  for (const { row, brawlers } of matches.values()) {
    // Победа: выигранный бой 3 на 3 или 1-е место в «Столкновении».
    const win = row.result === "victory" || row.rank === 1;
    if (win) wins++;
    add(modes, row.mode, win);
    if (row.map) add(maps, `${row.mode}|${row.map}`, win);
    // Связка — бравлеры участников в этом матче (по тем, чьи бои у нас есть).
    const ids = [...brawlers.values()].filter((id): id is number => id !== null).sort((a, b) => a - b);
    if (ids.length >= 2) add(combos, ids.join(","), win);
  }

  const together = matches.size;
  const toList = (m: Map<string, Bucket>) => [...m].map(([key, b]) => ({ key, ...b }));

  return {
    members: tags.length,
    together,
    wins,
    winRate: together > 0 ? Math.round((wins / together) * 100) : 0,
    modes: best(toList(modes), 3).map((m) => ({ mode: m.key, games: m.games, wins: m.wins })),
    maps: best(toList(maps), 3).map((m) => {
      const [mode, map] = m.key.split("|");
      return { mode, map, games: m.games, wins: m.wins };
    }),
    combos: best(toList(combos), 3).map((c) => ({
      brawlers: c.key.split(",").map((id) => ({ id: Number(id), name: brawlerNames.get(Number(id)) ?? null })),
      games: c.games,
      wins: c.wins,
    })),
  };
}
