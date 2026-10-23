import { and, count, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import { battles, friendships, hiddenUsers, playerProfiles, privacySettings, users } from "./db/schema";
import { LfgError } from "./lfg-server";

export const FRIEND_REQUESTS_PER_DAY = 20;

// Отношения между мной и другим игроком — так их видит кнопка на профиле.
// outgoing — я отправил (или мне отказали — этого я не вижу), incoming — мне прислали.
export type Relation = "self" | "none" | "outgoing" | "incoming" | "friends";

// Строка дружбы для пары (в любом направлении).
async function findPair(a: number, b: number) {
  const [row] = await getDb()
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
        and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
      ),
    );
  return row ?? null;
}

function relationFor(meId: number, row: Awaited<ReturnType<typeof findPair>>): Relation {
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  if (row.requesterId === meId) return "outgoing"; // pending или declined — для меня одинаково
  // Мне прислали: ждёт ответа — «входящая»; я отклонил — снова «нет отношений».
  return row.status === "pending" ? "incoming" : "none";
}

export async function userIdByTag(tag: string): Promise<number | null> {
  const [row] = await getDb().select({ id: users.id }).from(users).where(eq(users.playerTag, tag));
  return row?.id ?? null;
}

export async function getRelation(meId: number, otherId: number): Promise<Relation> {
  if (meId === otherId) return "self";
  return relationFor(meId, await findPair(meId, otherId));
}

export async function areFriends(a: number, b: number): Promise<boolean> {
  return (await getRelation(a, b)) === "friends";
}

// Отправить заявку в друзья. Возвращает новое состояние отношений.
// notify — кого и о чём уведомить через бота (делает маршрут).
export async function sendFriendRequest(meId: number, targetId: number) {
  const db = getDb();
  if (meId === targetId) throw new LfgError("Нельзя добавить в друзья самого себя", 400);

  const [me] = await db
    .select({ playerTag: users.playerTag, bannedAt: users.bannedAt })
    .from(users)
    .where(eq(users.id, meId));
  if (!me?.playerTag) throw new LfgError("Сначала привяжи аккаунт Brawl Stars", 400);
  if (me.bannedAt) throw new LfgError("Аккаунт заблокирован модератором", 403);

  const existing = await findPair(meId, targetId);
  if (existing) {
    if (existing.status === "accepted") return { relation: "friends" as const, notify: null };
    if (existing.requesterId === meId) return { relation: "outgoing" as const, notify: null };
    // Встречная заявка (ждёт меня или я её раньше отклонил) — значит, хотим оба: дружим.
    await db
      .update(friendships)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(friendships.id, existing.id));
    return { relation: "friends" as const, notify: { userId: targetId, kind: "accepted" as const } };
  }

  // Лимит исходящих заявок.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [sent] = await db
    .select({ n: count() })
    .from(friendships)
    .where(and(eq(friendships.requesterId, meId), gt(friendships.createdAt, dayAgo)));
  if ((sent?.n ?? 0) >= FRIEND_REQUESTS_PER_DAY) {
    throw new LfgError(`Можно отправлять не больше ${FRIEND_REQUESTS_PER_DAY} заявок в сутки`, 429);
  }

  const [settings] = await db
    .select({ accept: privacySettings.acceptFriendRequests })
    .from(privacySettings)
    .where(eq(privacySettings.userId, targetId));
  if (settings && !settings.accept) throw new LfgError("Этот игрок сейчас не принимает заявки в друзья", 403);

  // Если игрок меня скрыл — заявка «отправляется», но сразу считается отклонённой:
  // он её не увидит, а я не узнаю, что меня скрыли.
  const [hidden] = await db
    .select({ one: sql`1` })
    .from(hiddenUsers)
    .where(and(eq(hiddenUsers.userId, targetId), eq(hiddenUsers.hiddenUserId, meId)));

  await db.insert(friendships).values({
    requesterId: meId,
    addresseeId: targetId,
    status: hidden ? "declined" : "pending",
    respondedAt: hidden ? new Date() : null,
  });
  return {
    relation: "outgoing" as const,
    notify: hidden ? null : { userId: targetId, kind: "request" as const },
  };
}

// Принять или отклонить входящую заявку.
export async function answerFriendRequest(meId: number, requesterId: number, accept: boolean) {
  const updated = await getDb()
    .update(friendships)
    .set({ status: accept ? "accepted" : "declined", respondedAt: new Date() })
    .where(
      and(
        eq(friendships.requesterId, requesterId),
        eq(friendships.addresseeId, meId),
        eq(friendships.status, "pending"),
      ),
    )
    .returning({ id: friendships.id });
  if (updated.length === 0) throw new LfgError("Заявка уже неактуальна", 404);
}

// Удалить из друзей (или отменить свою заявку). Второй человек не получает уведомления.
export async function removeFriend(meId: number, otherId: number) {
  const row = await findPair(meId, otherId);
  if (!row) return;
  // Отклонённую заявку не удаляем никогда: иначе отправитель смог бы «отменить» её
  // и прислать снова. Для него она так и остаётся «отправленной».
  if (row.status === "declined") return;
  await getDb().delete(friendships).where(eq(friendships.id, row.id));
}

// Короткая карточка игрока для списков: из кеша профиля (его обновляет крон).
async function playerCards(userIds: number[]) {
  if (userIds.length === 0) return new Map<number, PlayerCard>();
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      tag: users.playerTag,
      profile: playerProfiles.data,
      lastBattleAt: sql<string | null>`(select max(${battles.battleTime}) from ${battles} where ${battles.playerTag} = ${users.playerTag})`,
    })
    .from(users)
    .leftJoin(playerProfiles, eq(playerProfiles.tag, users.playerTag))
    .where(inArray(users.id, userIds));

  return new Map(
    rows
      .filter((r) => r.tag)
      .map((r) => [
        r.id,
        {
          tag: r.tag!,
          name: r.profile?.name ?? r.tag!,
          trophies: r.profile?.trophies ?? null,
          iconId: r.profile?.iconId ?? null,
          lastBattleAt: r.lastBattleAt ? new Date(r.lastBattleAt).toISOString() : null,
        },
      ]),
  );
}

export interface PlayerCard {
  tag: string;
  name: string;
  trophies: number | null;
  iconId: number | null;
  lastBattleAt: string | null;
}

// Экран «Друзья»: входящие заявки и список друзей.
export async function getFriendsScreen(meId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.addresseeId, meId), eq(friendships.status, "pending")),
        and(
          eq(friendships.status, "accepted"),
          or(eq(friendships.requesterId, meId), eq(friendships.addresseeId, meId)),
        ),
      ),
    )
    .orderBy(desc(friendships.createdAt));

  const otherId = (r: (typeof rows)[number]) => (r.requesterId === meId ? r.addresseeId : r.requesterId);
  const cards = await playerCards(rows.map(otherId));

  const incoming = rows
    .filter((r) => r.status === "pending")
    .flatMap((r) => (cards.has(otherId(r)) ? [cards.get(otherId(r))!] : []));
  const friends = rows
    .filter((r) => r.status === "accepted")
    .flatMap((r) => (cards.has(otherId(r)) ? [cards.get(otherId(r))!] : []))
    // Сначала те, кто играл недавно.
    .sort((a, b) => (b.lastBattleAt ?? "").localeCompare(a.lastBattleAt ?? ""));

  return { incoming, friends };
}

// Id всех моих друзей — для фильтра «Только друзья» в LFG.
export async function friendIds(meId: number): Promise<number[]> {
  const rows = await getDb()
    .select({ a: friendships.requesterId, b: friendships.addresseeId })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, meId), eq(friendships.addresseeId, meId)),
      ),
    );
  return rows.map((r) => (r.a === meId ? r.b : r.a));
}
