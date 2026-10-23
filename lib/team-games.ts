import { and, asc, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { getDb } from "./db";
import {
  playerProfiles,
  teamGameResponses,
  teamGames,
  teamMembers,
  teams,
  users,
  type GameAnswer,
} from "./db/schema";
import { LfgError } from "./lfg-server";
import { TEAM_EMBLEMS } from "./teams";

const MAX_DAYS_AHEAD = 7;
export const REMINDER_MINUTES = 15;

// --- Часовой пояс ---

// Проверяем, что это настоящий часовой пояс (например, "Europe/Lisbon").
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("ru-RU", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Время игры по часам конкретного игрока: «сегодня в 19:00», «завтра в 09:30», «пт, 31 окт. в 19:00».
export function formatGameTime(startsAt: Date, timeZone: string | null, now = new Date()): string {
  const tz = timeZone ?? "UTC";
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("ru-RU", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(startsAt);
  const suffix = timeZone ? "" : " (UTC)";
  if (day(startsAt) === day(now)) return `сегодня в ${time}${suffix}`;
  if (day(startsAt) === day(new Date(now.getTime() + 86_400_000))) return `завтра в ${time}${suffix}`;
  const date = new Intl.DateTimeFormat("ru-RU", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(startsAt);
  return `${date} в ${time}${suffix}`;
}

// --- Данные для экрана ---

async function membership(userId: number) {
  const [m] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, userId));
  return m ?? null;
}

// Ближайшая неотменённая игра команды (идёт или начнётся; начавшуюся показываем ещё час).
async function upcomingGame(teamId: number) {
  const [game] = await getDb()
    .select()
    .from(teamGames)
    .where(
      and(
        eq(teamGames.teamId, teamId),
        isNull(teamGames.cancelledAt),
        gt(teamGames.startsAt, new Date(Date.now() - 60 * 60 * 1000)),
      ),
    )
    .orderBy(asc(teamGames.startsAt))
    .limit(1);
  return game ?? null;
}

export async function getTeamGame(userId: number, teamId: number) {
  const game = await upcomingGame(teamId);
  if (!game) return null;
  const db = getDb();
  const answers = await db.select().from(teamGameResponses).where(eq(teamGameResponses.gameId, game.id));
  const members = await db
    .select({ userId: teamMembers.userId, profile: playerProfiles.data, tag: users.playerTag })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.tag, users.playerTag))
    .where(eq(teamMembers.teamId, teamId));

  return {
    id: game.id,
    startsAt: game.startsAt.toISOString(),
    myAnswer: answers.find((a) => a.userId === userId)?.answer ?? null,
    players: members.map((m) => ({
      name: m.profile?.name ?? m.tag ?? "Игрок",
      isMe: m.userId === userId,
      answer: answers.find((a) => a.userId === m.userId)?.answer ?? null,
    })),
  };
}

// --- Действия ---

// Капитан назначает игру. Возвращает данные для рассылки.
export async function scheduleGame(userId: number, startsAtRaw: unknown) {
  const me = await membership(userId);
  if (!me || me.role !== "captain") throw new LfgError("Назначать игры может только капитан", 403);

  const startsAt = new Date(typeof startsAtRaw === "string" ? startsAtRaw : NaN);
  if (Number.isNaN(startsAt.getTime())) throw new LfgError("Неверное время", 400);
  if (startsAt.getTime() < Date.now() + 5 * 60 * 1000) throw new LfgError("Выбери время хотя бы через 5 минут", 400);
  if (startsAt.getTime() > Date.now() + MAX_DAYS_AHEAD * 86_400_000) {
    throw new LfgError(`Можно планировать не больше чем на ${MAX_DAYS_AHEAD} дней вперёд`, 400);
  }
  if (await upcomingGame(me.teamId)) throw new LfgError("У команды уже есть запланированная игра. Сначала отмени её.", 409);

  const db = getDb();
  const [game] = await db
    .insert(teamGames)
    .values({ teamId: me.teamId, createdBy: userId, startsAt })
    .returning({ id: teamGames.id });
  // Капитан, раз назначил, — точно будет.
  await db.insert(teamGameResponses).values({ gameId: game.id, userId, answer: "yes" });
  return game.id;
}

// Ответ «Буду» / «Не смогу» — из приложения или кнопкой в чате с ботом.
export async function answerGame(userId: number, gameId: number, answer: GameAnswer) {
  const db = getDb();
  const [game] = await db.select().from(teamGames).where(eq(teamGames.id, gameId));
  if (!game || game.cancelledAt) throw new LfgError("Эта игра отменена", 404);
  if (game.startsAt < new Date()) throw new LfgError("Игра уже началась", 400);
  const me = await membership(userId);
  if (!me || me.teamId !== game.teamId) throw new LfgError("Ты не в этой команде", 403);

  await db
    .insert(teamGameResponses)
    .values({ gameId, userId, answer })
    .onConflictDoUpdate({
      target: [teamGameResponses.gameId, teamGameResponses.userId],
      set: { answer, answeredAt: new Date() },
    });
  return game;
}

export async function cancelGame(userId: number, gameId: number) {
  const me = await membership(userId);
  if (!me || me.role !== "captain") throw new LfgError("Отменять игры может только капитан", 403);
  const cancelled = await getDb()
    .update(teamGames)
    .set({ cancelledAt: new Date() })
    .where(and(eq(teamGames.id, gameId), eq(teamGames.teamId, me.teamId), isNull(teamGames.cancelledAt)))
    .returning({ id: teamGames.id });
  if (cancelled.length === 0) throw new LfgError("Игра уже отменена", 404);
}

// --- Для рассылок ---

// Участники команды игры: id, часовой пояс, ник и ответ.
export async function gameRecipients(gameId: number) {
  const db = getDb();
  const [game] = await db.select().from(teamGames).where(eq(teamGames.id, gameId));
  if (!game) return null;
  const [team] = await db.select().from(teams).where(eq(teams.id, game.teamId));
  const members = await db
    .select({ userId: teamMembers.userId, timeZone: users.timeZone, profile: playerProfiles.data, tag: users.playerTag })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.tag, users.playerTag))
    .where(eq(teamMembers.teamId, game.teamId));
  const answers = await db.select().from(teamGameResponses).where(eq(teamGameResponses.gameId, gameId));
  return {
    game,
    team: { name: team.name, emblem: TEAM_EMBLEMS[team.emblem] ?? "🛡️" },
    members: members.map((m) => ({
      userId: m.userId,
      timeZone: m.timeZone,
      name: m.profile?.name ?? m.tag ?? "Игрок",
      answer: answers.find((a) => a.userId === m.userId)?.answer ?? null,
    })),
  };
}

// Игры, которым пора напомнить: начнутся в ближайшие 15 минут, напоминания ещё не было.
// Сразу помечаем — чтобы два запуска крона не напомнили дважды.
export async function claimGamesToRemind(): Promise<number[]> {
  const db = getDb();
  const now = new Date();
  const due = await db
    .select({ id: teamGames.id })
    .from(teamGames)
    .where(
      and(
        isNull(teamGames.cancelledAt),
        isNull(teamGames.reminderSentAt),
        gt(teamGames.startsAt, now),
        lte(teamGames.startsAt, new Date(now.getTime() + REMINDER_MINUTES * 60 * 1000)),
      ),
    );
  if (due.length === 0) return [];
  const claimed = await db
    .update(teamGames)
    .set({ reminderSentAt: now })
    .where(and(inArray(teamGames.id, due.map((g) => g.id)), isNull(teamGames.reminderSentAt)))
    .returning({ id: teamGames.id });
  return claimed.map((g) => g.id);
}
