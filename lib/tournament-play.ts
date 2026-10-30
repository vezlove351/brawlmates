import { and, asc, count, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import { isAdmin } from "./admin";
import { getBot } from "./bot";
import { getDb } from "./db";
import { playerProfiles, tournamentParticipants, tournaments, users } from "./db/schema";
import { LfgError } from "./lfg-server";
import { getPlayerProfile } from "./profile";
import { formatGameTime } from "./team-games";
import { getStandings, getTournamentRow, isChannelMember, publicTournament, tournamentLink } from "./tournaments";

// ===================== Турниры для игроков =====================

// Ближайшие (запись или идут) и прошедшие турниры.
export async function listTournaments(userId: number) {
  const db = getDb();
  const rows = await db
    .select({
      t: tournaments,
      participants: sql<number>`(select count(*)::int from ${tournamentParticipants} where ${tournamentParticipants.tournamentId} = ${tournaments.id})`,
      joined: sql<boolean>`exists (select 1 from ${tournamentParticipants} where ${tournamentParticipants.tournamentId} = ${tournaments.id} and ${tournamentParticipants.userId} = ${userId})`,
    })
    .from(tournaments)
    .where(inArray(tournaments.status, ["registration", "live", "finished", "cancelled"]))
    .orderBy(asc(tournaments.startsAt));

  const card = (r: (typeof rows)[number]) => ({ ...publicTournament(r.t), participants: r.participants, joined: r.joined });
  return {
    upcoming: rows.filter((r) => r.t.status === "registration" || r.t.status === "live").map(card),
    past: rows
      .filter((r) => r.t.status === "finished" || r.t.status === "cancelled")
      .reverse()
      .slice(0, 20)
      .map(card),
  };
}

// Страница турнира: описание, участники, моё участие и почему нельзя записаться (если нельзя).
export async function getTournamentPage(userId: number, id: number) {
  const t = await getTournamentRow(id);
  // Черновик видит только админ.
  if (t.status === "draft" && !isAdmin(userId)) throw new LfgError("Турнир не найден", 404);

  const participants = await getDb()
    .select({ userId: tournamentParticipants.userId, tag: tournamentParticipants.playerTag, profile: playerProfiles.data })
    .from(tournamentParticipants)
    .leftJoin(playerProfiles, eq(playerProfiles.tag, tournamentParticipants.playerTag))
    .where(eq(tournamentParticipants.tournamentId, id))
    .orderBy(asc(tournamentParticipants.joinedAt));

  const joined = participants.some((p) => p.userId === userId);
  const standings = t.status === "live" || t.status === "finished" ? await getStandings(id) : [];

  return {
    tournament: publicTournament(t),
    link: tournamentLink(id),
    participants: participants.map((p) => ({
      tag: p.tag,
      name: p.profile?.name ?? p.tag,
      trophies: p.profile?.trophies ?? null,
      iconId: p.profile?.iconId ?? null,
      isMe: p.userId === userId,
    })),
    joined,
    // Подсказка заранее, без запроса к Telegram и API (точная проверка — при записи).
    canLeave: joined && t.status === "registration" && t.startsAt > new Date(),
    standings: standings.map((s) => ({ ...s, isMe: s.userId === userId, userId: undefined })),
  };
}

// «Участвовать». Все условия проверяются здесь, на сервере.
export async function joinTournament(userId: number, id: number) {
  const db = getDb();
  const t = await getTournamentRow(id);
  if (t.status !== "registration") throw new LfgError("Запись на этот турнир закрыта", 409);
  if (t.startsAt <= new Date()) throw new LfgError("Турнир уже начался", 409);

  const [me] = await db
    .select({ tag: users.playerTag, bannedAt: users.bannedAt })
    .from(users)
    .where(eq(users.id, userId));
  if (!me?.tag) throw new LfgError("Сначала привяжи аккаунт Brawl Stars", 400);
  if (me.bannedAt) throw new LfgError("Аккаунт заблокирован модератором", 403);

  const [already] = await db
    .select({ one: sql`1` })
    .from(tournamentParticipants)
    .where(and(eq(tournamentParticipants.tournamentId, id), eq(tournamentParticipants.userId, userId)));
  if (already) return; // уже участвует — ничего не делаем

  // Условие участия.
  if (t.condition === "channel" && !(await isChannelMember(userId))) {
    throw new LfgError("Турнир — для подписчиков канала @brawlmate_app. Подпишись и нажми ещё раз.", 403);
  }
  if (t.condition === "min_trophies") {
    const { profile } = await getPlayerProfile(me.tag);
    if (profile.trophies < (t.minTrophies ?? 0)) {
      throw new LfgError(`Нужно от ${t.minTrophies} трофеев, у тебя ${profile.trophies}`, 403);
    }
  }

  const [{ n }] = await db
    .select({ n: count() })
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.tournamentId, id));
  if (n >= t.maxPlayers) throw new LfgError("Мест больше нет — все места заняты", 409);

  try {
    await db.insert(tournamentParticipants).values({ tournamentId: id, userId, playerTag: me.tag });
  } catch {
    throw new LfgError("Этот игровой аккаунт уже записан на турнир", 409);
  }

  // Два человека нажали одновременно на последнее место — лишний выходит.
  const [{ total }] = await db
    .select({ total: count() })
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.tournamentId, id));
  if (total > t.maxPlayers) {
    await db
      .delete(tournamentParticipants)
      .where(and(eq(tournamentParticipants.tournamentId, id), eq(tournamentParticipants.userId, userId)));
    throw new LfgError("Мест больше нет — все места заняты", 409);
  }
}

// «Отменить участие» — только пока идёт запись и турнир не начался.
export async function leaveTournament(userId: number, id: number) {
  const t = await getTournamentRow(id);
  if (t.status !== "registration" || t.startsAt <= new Date()) {
    throw new LfgError("Турнир уже начался — отменить участие нельзя", 409);
  }
  await getDb()
    .delete(tournamentParticipants)
    .where(and(eq(tournamentParticipants.tournamentId, id), eq(tournamentParticipants.userId, userId)));
}

// ===================== Напоминания =====================

// Забираем турниры, которым пора напомнить, и сразу помечаем — чтобы не напомнить дважды.
async function claimReminders(kind: "hour" | "ten") {
  const db = getDb();
  const now = Date.now();
  const window = kind === "hour" ? 60 : 10;
  const column = kind === "hour" ? tournaments.reminderHourSentAt : tournaments.reminderTenSentAt;
  const set = kind === "hour" ? { reminderHourSentAt: new Date() } : { reminderTenSentAt: new Date() };
  const claimed = await db
    .update(tournaments)
    .set(set)
    .where(
      and(
        inArray(tournaments.status, ["registration", "live"]),
        isNull(column),
        gt(tournaments.startsAt, new Date(now)),
        lte(tournaments.startsAt, new Date(now + window * 60 * 1000)),
      ),
    )
    .returning();
  return claimed;
}

export async function sendTournamentReminders() {
  let sent = 0;
  for (const kind of ["hour", "ten"] as const) {
    for (const t of await claimReminders(kind)) {
      const people = await getDb()
        .select({ userId: tournamentParticipants.userId, timeZone: users.timeZone })
        .from(tournamentParticipants)
        .innerJoin(users, eq(users.id, tournamentParticipants.userId))
        .where(eq(tournamentParticipants.tournamentId, t.id));
      for (const p of people) {
        const text =
          kind === "hour"
            ? `⏰ Через час турнир «${t.title}» — ${formatGameTime(t.startsAt, p.timeZone)}.\n\nПеред каждым раундом я пришлю ссылку на комнату. Зарядись и будь на связи!`
            : `🔥 Через 10 минут турнир «${t.title}»! Открой Brawl Stars — скоро пришлю ссылку на комнату.`;
        await getBot()
          .api.sendMessage(p.userId, text, {
            reply_markup: { inline_keyboard: [[{ text: "Открыть турнир", url: tournamentLink(t.id) }]] },
          })
          .then(() => sent++)
          .catch((err: unknown) => console.error("Турнир: не удалось напомнить:", err instanceof Error ? err.message : err));
      }
    }
  }
  return sent;
}

