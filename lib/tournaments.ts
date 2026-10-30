import { and, desc, eq, sql } from "drizzle-orm";
import { getBot } from "./bot";
import { getDb } from "./db";
import {
  playerProfiles,
  tournamentParticipants,
  tournamentResults,
  tournamentRounds,
  tournaments,
  users,
  type TournamentCondition,
} from "./db/schema";
import { LfgError } from "./lfg-server";
import { APP_SHORT_NAME, BOT_USERNAME, LFG_CHANNEL } from "./links";
import { checkComment } from "./moderation";

// Таблица очков турнира. Не хранится отдельно, а считается из результатов раундов —
// поэтому никогда не расходится с ними: поправили место — очки пересчитались сами.
export async function getStandings(tournamentId: number) {
  const db = getDb();
  const rows = await db
    .select({
      userId: tournamentParticipants.userId,
      playerTag: tournamentParticipants.playerTag,
      name: sql<string | null>`${playerProfiles.data}->>'name'`,
      points: sql<number>`coalesce(sum(${tournamentResults.points}) filter (where ${tournamentRounds.status} = 'confirmed'), 0)::int`,
      roundsPlayed: sql<number>`count(${tournamentResults.place}) filter (where ${tournamentRounds.status} = 'confirmed')::int`,
      bestPlace: sql<number | null>`min(${tournamentResults.place}) filter (where ${tournamentRounds.status} = 'confirmed')`,
      wins: sql<number>`count(*) filter (where ${tournamentResults.place} = 1 and ${tournamentRounds.status} = 'confirmed')::int`,
    })
    .from(tournamentParticipants)
    .innerJoin(users, eq(users.id, tournamentParticipants.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.tag, tournamentParticipants.playerTag))
    .leftJoin(tournamentRounds, eq(tournamentRounds.tournamentId, tournamentParticipants.tournamentId))
    .leftJoin(
      tournamentResults,
      and(eq(tournamentResults.roundId, tournamentRounds.id), eq(tournamentResults.userId, tournamentParticipants.userId)),
    )
    .where(eq(tournamentParticipants.tournamentId, tournamentId))
    .groupBy(tournamentParticipants.userId, tournamentParticipants.playerTag, playerProfiles.data);

  // Больше очков — выше; при равенстве — больше побед, потом лучшее место.
  rows.sort(
    (a, b) => b.points - a.points || b.wins - a.wins || (a.bestPlace ?? 99) - (b.bestPlace ?? 99),
  );
  return rows.map((r, i) => ({ ...r, name: r.name ?? r.playerTag, position: i + 1 }));
}

// Очки за место по правилам турнира (места вне списка — 0).
export function pointsFor(place: number | null, pointsByPlace: number[]): number {
  if (place === null || place < 1) return 0;
  return pointsByPlace[place - 1] ?? 0;
}

// ===================== Создание и управление (админ) =====================


export const TOURNAMENT_CONDITIONS: Record<TournamentCondition, string> = {
  all: "Все игроки Brawlmates",
  channel: "Подписчики канала @brawlmate_app",
  min_trophies: "От N трофеев",
};

export function tournamentLink(id: number): string {
  return `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}?startapp=t_${id}`;
}

// Подписан ли пользователь на канал — проверяем через getChatMember.
export async function isChannelMember(userId: number): Promise<boolean> {
  try {
    const member = await getBot().api.getChatMember(LFG_CHANNEL, userId);
    if (member.status === "restricted") return member.is_member;
    return ["creator", "administrator", "member"].includes(member.status);
  } catch {
    // Telegram не знает этого пользователя в канале — значит, не подписан.
    return false;
  }
}

export interface TournamentInput {
  title: unknown;
  description: unknown;
  startsAt: unknown;
  map: unknown;
  rounds: unknown;
  pointsByPlace: unknown;
  maxPlayers: unknown;
  condition: unknown;
  minTrophies: unknown;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const int = (v: unknown) => (typeof v === "number" ? v : Number(v));

function cleanText(value: string, what: string) {
  const check = checkComment(value);
  if (!check.ok) throw new LfgError(check.reason.replace("комментарии", what), 400);
  return value;
}

export async function createTournament(adminId: number, input: TournamentInput) {
  const title = str(input.title).replace(/\s+/g, " ");
  if (title.length < 3 || title.length > 60) throw new LfgError("Название — от 3 до 60 символов", 400);
  cleanText(title, "названии");

  const description = str(input.description);
  if (description.length > 500) throw new LfgError("Описание — не длиннее 500 символов", 400);
  if (description) cleanText(description, "описании");

  const startsAt = new Date(str(input.startsAt));
  if (Number.isNaN(startsAt.getTime())) throw new LfgError("Укажи дату и время старта", 400);
  if (startsAt.getTime() < Date.now() + 15 * 60 * 1000) throw new LfgError("Старт — не раньше чем через 15 минут", 400);

  const map = str(input.map).slice(0, 60) || null;

  const rounds = int(input.rounds);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10) throw new LfgError("Раундов — от 1 до 10", 400);

  const maxPlayers = int(input.maxPlayers);
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 10) {
    throw new LfgError("Участников — от 2 до 10 (столько мест в комнате)", 400);
  }

  const points = Array.isArray(input.pointsByPlace) ? input.pointsByPlace.map(int) : [];
  if (points.length < 1 || points.length > 10 || points.some((p) => !Number.isInteger(p) || p < 0 || p > 100)) {
    throw new LfgError("Очки за места — целые числа от 0 до 100, не больше 10 мест", 400);
  }
  if (points.some((p, i) => i > 0 && p > points[i - 1])) {
    throw new LfgError("Очки за место ниже не могут быть больше, чем за место выше", 400);
  }

  const condition = str(input.condition) as TournamentCondition;
  if (!(condition in TOURNAMENT_CONDITIONS)) throw new LfgError("Выбери условие участия", 400);
  const minTrophies = condition === "min_trophies" ? int(input.minTrophies) : null;
  if (condition === "min_trophies" && (!Number.isInteger(minTrophies) || minTrophies! < 1)) {
    throw new LfgError("Укажи минимальные трофеи", 400);
  }

  const [t] = await getDb()
    .insert(tournaments)
    .values({
      title, description: description || null, startsAt, map, rounds, pointsByPlace: points,
      maxPlayers, condition, minTrophies, createdBy: adminId,
    })
    .returning({ id: tournaments.id });
  return t.id;
}

// Все турниры для /admin: сначала ближайшие.
export async function listTournamentsForAdmin() {
  const rows = await getDb()
    .select({
      t: tournaments,
      participants: sql<number>`(select count(*)::int from ${tournamentParticipants} where ${tournamentParticipants.tournamentId} = ${tournaments.id})`,
    })
    .from(tournaments)
    .orderBy(desc(tournaments.startsAt));
  return rows.map(({ t, participants }) => ({ ...publicTournament(t), participants }));
}

type TournamentRow = typeof tournaments.$inferSelect;

export function publicTournament(t: TournamentRow) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    format: t.format,
    startsAt: t.startsAt.toISOString(),
    map: t.map,
    rounds: t.rounds,
    pointsByPlace: t.pointsByPlace,
    maxPlayers: t.maxPlayers,
    condition: t.condition,
    minTrophies: t.minTrophies,
    status: t.status,
  };
}

export async function getTournamentRow(id: number) {
  const [t] = await getDb().select().from(tournaments).where(eq(tournaments.id, id));
  if (!t) throw new LfgError("Турнир не найден", 404);
  return t;
}

// Открыть регистрацию: черновик → запись. Возвращает турнир для анонса в канале.
export async function openRegistration(id: number) {
  const t = await getTournamentRow(id);
  if (t.status !== "draft") throw new LfgError("Регистрация уже открыта", 409);
  if (t.startsAt < new Date()) throw new LfgError("Время старта уже прошло — создай турнир заново", 400);
  await getDb().update(tournaments).set({ status: "registration" }).where(eq(tournaments.id, id));
  return t;
}

// Удалить черновик (пока регистрация не открыта, его никто не видел).
export async function deleteDraft(id: number) {
  const removed = await getDb()
    .delete(tournaments)
    .where(and(eq(tournaments.id, id), eq(tournaments.status, "draft")))
    .returning({ id: tournaments.id });
  if (removed.length === 0) throw new LfgError("Удалить можно только черновик", 409);
}

// Анонс в канале: время — по Москве (основная аудитория), со ссылкой «Участвовать».
export async function announceTournament(t: TournamentRow) {
  const when = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(t.startsAt);
  const condition =
    t.condition === "min_trophies" ? `от ${t.minTrophies} трофеев` : t.condition === "channel" ? "для подписчиков канала" : "для всех";
  const lines = [
    `🏆 Турнир «${t.title}»`,
    "",
    t.description,
    `📅 ${when} (МСК)`,
    `🎮 Одиночное столкновение${t.map ? ` · ${t.map}` : ""} · ${t.rounds} раунд(а)`,
    `👥 До ${t.maxPlayers} игроков · ${condition}`,
    `🥇 Очки за места: ${t.pointsByPlace.join(" / ")}`,
    "",
    "Участие бесплатное. Записывайся 👇",
  ].filter((l) => l !== null);
  await getBot().api.sendMessage(LFG_CHANNEL, lines.join("\n"), {
    reply_markup: { inline_keyboard: [[{ text: "🏆 Участвовать", url: tournamentLink(t.id) }]] },
    link_preview_options: { is_disabled: true },
  });
}
