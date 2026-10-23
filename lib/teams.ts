import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, inArray, isNull, lt, notInArray } from "drizzle-orm";
import { getDb } from "./db";
import { playerProfiles, teamInvites, teamMembers, teams, users, type TeamRole } from "./db/schema";
import { friendIds } from "./friends-server";
import { LfgError } from "./lfg-server";
import { APP_SHORT_NAME, BOT_USERNAME } from "./links";
import { checkComment } from "./moderation";
import { getTeamGame } from "./team-games";

export const TEAM_MAX_MEMBERS = 3;
export const TEAM_NAME_MAX = 24;
const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

// Готовый набор эмблем: ключ хранится в базе, эмодзи показывается.
export const TEAM_EMBLEMS: Record<string, string> = {
  fire: "🔥", bolt: "⚡", dragon: "🐉", lion: "🦁", gem: "💎", rocket: "🚀",
  crown: "👑", star: "🌟", target: "🎯", shield: "🛡️", wolf: "🐺", robot: "🤖",
  ghost: "👻", alien: "👽", ninja: "🥷", trophy: "🏆",
};

export function teamInviteLink(code: string): string {
  return `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}?startapp=team_${code}`;
}

// --- Вспомогательное ---

async function membershipOf(userId: number) {
  const [row] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, userId));
  return row ?? null;
}

async function membersOf(teamId: number) {
  return getDb()
    .select({
      userId: teamMembers.userId,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
      tag: users.playerTag,
      profile: playerProfiles.data,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.tag, users.playerTag))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(teamMembers.joinedAt));
}

async function requireLinkedPlayer(userId: number) {
  const [me] = await getDb()
    .select({ tag: users.playerTag, bannedAt: users.bannedAt })
    .from(users)
    .where(eq(users.id, userId));
  if (!me?.tag) throw new LfgError("Сначала привяжи аккаунт Brawl Stars", 400);
  if (me.bannedAt) throw new LfgError("Аккаунт заблокирован модератором", 403);
}

function validateName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > TEAM_NAME_MAX) {
    throw new LfgError(`Название — от 2 до ${TEAM_NAME_MAX} символов`, 400);
  }
  const check = checkComment(name);
  if (!check.ok) throw new LfgError(check.reason.replace("комментарии", "названии"), 400);
  return name;
}

const newCode = () => randomBytes(9).toString("base64url"); // 12 символов: A-Z a-z 0-9 - _

// --- Экран «Моя команда» ---

export async function getMyTeam(userId: number) {
  const db = getDb();
  const membership = await membershipOf(userId);

  if (!membership) {
    // Нет команды — показываем приглашения, адресованные мне.
    const invites = await db
      .select({ code: teamInvites.code, teamId: teamInvites.teamId, name: teams.name, emblem: teams.emblem })
      .from(teamInvites)
      .innerJoin(teams, eq(teams.id, teamInvites.teamId))
      .where(
        and(
          eq(teamInvites.invitedUserId, userId),
          isNull(teamInvites.usedAt),
          gt(teamInvites.expiresAt, new Date()),
        ),
      );
    return {
      team: null,
      invites: invites.map((i) => ({ code: i.code, name: i.name, emblem: TEAM_EMBLEMS[i.emblem] ?? "🛡️" })),
    };
  }

  const [team] = await db.select().from(teams).where(eq(teams.id, membership.teamId));
  const members = await membersOf(membership.teamId);

  // Кого можно пригласить: мои друзья, которые ещё ни в какой команде.
  const friends = await friendIds(userId);
  const candidates =
    friends.length === 0 || members.length >= TEAM_MAX_MEMBERS
      ? []
      : await db
          .select({ tag: users.playerTag, profile: playerProfiles.data })
          .from(users)
          .leftJoin(playerProfiles, eq(playerProfiles.tag, users.playerTag))
          .where(
            and(
              inArray(users.id, friends),
              notInArray(users.id, db.select({ id: teamMembers.userId }).from(teamMembers)),
            ),
          );

  return {
    team: {
      id: team.id,
      name: team.name,
      emblem: TEAM_EMBLEMS[team.emblem] ?? "🛡️",
      myRole: membership.role as TeamRole,
      members: members.map((m) => ({
        tag: m.tag ?? "",
        name: m.profile?.name ?? m.tag ?? "Игрок",
        trophies: m.profile?.trophies ?? null,
        iconId: m.profile?.iconId ?? null,
        role: m.role as TeamRole,
        isMe: m.userId === userId,
      })),
      maxMembers: TEAM_MAX_MEMBERS,
    },
    game: await getTeamGame(userId, membership.teamId),
    candidates: candidates
      .filter((c) => c.tag)
      .map((c) => ({ tag: c.tag!, name: c.profile?.name ?? c.tag!, trophies: c.profile?.trophies ?? null })),
    invites: [],
  };
}

// --- Действия ---

export async function createTeam(userId: number, rawName: unknown, rawEmblem: unknown) {
  await requireLinkedPlayer(userId);
  if (await membershipOf(userId)) throw new LfgError("Ты уже в команде. Чтобы создать новую — выйди из текущей.", 409);
  const name = validateName(rawName);
  const emblem = typeof rawEmblem === "string" && rawEmblem in TEAM_EMBLEMS ? rawEmblem : null;
  if (!emblem) throw new LfgError("Выбери эмблему из списка", 400);

  const db = getDb();
  const [team] = await db.insert(teams).values({ name, emblem }).returning({ id: teams.id });
  try {
    await db.insert(teamMembers).values({ userId, teamId: team.id, role: "captain" });
  } catch {
    // Двойное нажатие: игрок уже успел попасть в команду — убираем лишнюю пустую.
    await db.delete(teams).where(eq(teams.id, team.id));
    throw new LfgError("Ты уже в команде", 409);
  }
}

async function requireTeamWithRoom(userId: number) {
  const membership = await membershipOf(userId);
  if (!membership) throw new LfgError("Сначала создай команду", 400);
  const members = await membersOf(membership.teamId);
  if (members.length >= TEAM_MAX_MEMBERS) {
    throw new LfgError(`В команде уже ${TEAM_MAX_MEMBERS} игрока — это максимум`, 409);
  }
  return membership;
}

// Пригласить друга (адресный инвайт). Возвращает данные для уведомления от бота.
export async function inviteFriend(userId: number, friendId: number) {
  const membership = await requireTeamWithRoom(userId);
  if (!(await friendIds(userId)).includes(friendId)) {
    throw new LfgError("Пригласить в команду можно только друга", 403);
  }
  if (await membershipOf(friendId)) throw new LfgError("Этот игрок уже в команде", 409);

  const code = newCode();
  await getDb().insert(teamInvites).values({
    teamId: membership.teamId,
    code,
    createdBy: userId,
    invitedUserId: friendId,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });
  const [team] = await getDb().select().from(teams).where(eq(teams.id, membership.teamId));
  return { code, teamName: team.name, emblem: TEAM_EMBLEMS[team.emblem] ?? "🛡️" };
}

// Одноразовая ссылка-приглашение для любого (живёт 24 часа).
export async function createInviteLink(userId: number) {
  const membership = await requireTeamWithRoom(userId);
  const code = newCode();
  await getDb().insert(teamInvites).values({
    teamId: membership.teamId,
    code,
    createdBy: userId,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });
  const [team] = await getDb().select({ name: teams.name }).from(teams).where(eq(teams.id, membership.teamId));
  return { link: teamInviteLink(code), teamName: team.name };
}

// Проверка инвайта: годится ли он для этого пользователя. Возвращает инвайт или причину.
async function checkInvite(userId: number, code: string) {
  const [invite] = await getDb().select().from(teamInvites).where(eq(teamInvites.code, code));
  if (!invite) return { error: "Приглашение не найдено" };
  if (invite.usedAt) return { error: "Это приглашение уже использовано" };
  if (invite.expiresAt < new Date()) return { error: "Срок приглашения истёк (оно действует 24 часа)" };
  if (invite.invitedUserId && invite.invitedUserId !== userId) return { error: "Это приглашение для другого игрока" };
  return { invite };
}

// Карточка приглашения для экрана «Вступить в команду».
export async function getInviteInfo(userId: number, code: string) {
  const { invite, error } = await checkInvite(userId, code);
  if (!invite) return { valid: false as const, error };
  const [team] = await getDb().select().from(teams).where(eq(teams.id, invite.teamId));
  const members = await membersOf(invite.teamId);
  const alreadyInTeam = await membershipOf(userId);
  return {
    valid: true as const,
    team: {
      name: team.name,
      emblem: TEAM_EMBLEMS[team.emblem] ?? "🛡️",
      members: members.map((m) => ({ name: m.profile?.name ?? m.tag ?? "Игрок", role: m.role })),
      full: members.length >= TEAM_MAX_MEMBERS,
    },
    alreadyInTeam: alreadyInTeam !== null,
  };
}

export async function joinByInvite(userId: number, code: string) {
  await requireLinkedPlayer(userId);
  const { invite, error } = await checkInvite(userId, code);
  if (!invite) throw new LfgError(error ?? "Приглашение недействительно", 400);
  if (await membershipOf(userId)) throw new LfgError("Ты уже в команде. Сначала выйди из текущей.", 409);
  if ((await membersOf(invite.teamId)).length >= TEAM_MAX_MEMBERS) {
    throw new LfgError("В команде уже нет мест", 409);
  }

  const db = getDb();
  // Одноразовость: помечаем инвайт использованным, только если его ещё никто не занял.
  const claimed = await db
    .update(teamInvites)
    .set({ usedBy: userId, usedAt: new Date() })
    .where(and(eq(teamInvites.id, invite.id), isNull(teamInvites.usedAt)))
    .returning({ id: teamInvites.id });
  if (claimed.length === 0) throw new LfgError("Это приглашение уже использовано", 409);

  try {
    await db.insert(teamMembers).values({ userId, teamId: invite.teamId, role: "member" });
  } catch {
    throw new LfgError("Ты уже в команде", 409);
  }
}

// «Не сейчас» на адресное приглашение — просто удаляем его.
export async function declineInvite(userId: number, code: string) {
  await getDb()
    .delete(teamInvites)
    .where(and(eq(teamInvites.code, code), eq(teamInvites.invitedUserId, userId)));
}

// Капитан исключает участника.
export async function kickMember(captainId: number, targetId: number) {
  const me = await membershipOf(captainId);
  if (!me || me.role !== "captain") throw new LfgError("Исключать может только капитан", 403);
  if (targetId === captainId) throw new LfgError("Чтобы уйти самому — нажми «Выйти из команды»", 400);
  const removed = await getDb()
    .delete(teamMembers)
    .where(and(eq(teamMembers.userId, targetId), eq(teamMembers.teamId, me.teamId)))
    .returning({ userId: teamMembers.userId });
  if (removed.length === 0) throw new LfgError("Этого игрока нет в твоей команде", 404);
}

// Выйти из команды. Капитан передаёт роль самому давнему участнику; пустая команда удаляется.
export async function leaveTeam(userId: number) {
  const db = getDb();
  const me = await membershipOf(userId);
  if (!me) return;

  await db.delete(teamMembers).where(eq(teamMembers.userId, userId));
  const rest = await membersOf(me.teamId);

  if (rest.length === 0) {
    await db.delete(teams).where(eq(teams.id, me.teamId));
    return;
  }
  if (me.role === "captain") {
    await db.update(teamMembers).set({ role: "captain" }).where(eq(teamMembers.userId, rest[0].userId));
  }
}

// Удалить неиспользованные просроченные приглашения (вызывает крон уборки).
export async function cleanupExpiredInvites(): Promise<number> {
  const removed = await getDb()
    .delete(teamInvites)
    .where(and(isNull(teamInvites.usedAt), lt(teamInvites.expiresAt, new Date())))
    .returning({ id: teamInvites.id });
  return removed.length;
}
