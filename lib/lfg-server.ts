import { and, count, desc, eq, gt, gte, inArray, isNull, lt, ne, notExists, sql } from "drizzle-orm";
import { scheduleRemoval } from "./channel";
import { getDb } from "./db";
import {
  friendships,
  hiddenUsers,
  lfgPosts,
  lfgReports,
  lfgResponses,
  privacySettings,
  users,
  type ReportReason,
} from "./db/schema";
import {
  findBracket,
  findLanguage,
  findMode,
  LFG_COMMENT_MAX,
  LFG_DAILY_POST_LIMIT,
  LFG_HOURLY_RESPONSE_LIMIT,
  LFG_MAX_BRAWLERS,
  LFG_POST_TTL_MS,
  type LfgPostInput,
} from "./lfg";
import { checkComment } from "./moderation";
import { getPlayerProfile } from "./profile";

// Ошибка, которую можно показать игроку, с HTTP-кодом.
export class LfgError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Заявки, у которых прошло 2 часа, помечаем истёкшими.
// Крон делает это для всех (задача 8), а здесь — для одного автора, чтобы не ждать крона.
async function expireOwnPosts(authorId: number) {
  const expired = await getDb()
    .update(lfgPosts)
    .set({ status: "expired" })
    .where(
      and(eq(lfgPosts.authorId, authorId), eq(lfgPosts.status, "active"), lt(lfgPosts.expiresAt, new Date())),
    )
    .returning({ id: lfgPosts.id });
  scheduleRemoval(expired.map((p) => p.id));
}

export async function getActivePost(authorId: number) {
  await expireOwnPosts(authorId);
  const [post] = await getDb()
    .select()
    .from(lfgPosts)
    .where(and(eq(lfgPosts.authorId, authorId), eq(lfgPosts.status, "active")))
    .orderBy(desc(lfgPosts.createdAt))
    .limit(1);
  return post ?? null;
}

export async function countPostsLast24h(authorId: number): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await getDb()
    .select({ n: count() })
    .from(lfgPosts)
    .where(and(eq(lfgPosts.authorId, authorId), gt(lfgPosts.createdAt, since)));
  return row?.n ?? 0;
}

// Создание заявки. Все правила проверяются здесь, на сервере, —
// интерфейсу доверять нельзя: запрос можно отправить и в обход формы.
export async function createPost(userId: number, input: LfgPostInput) {
  const db = getDb();

  const [user] = await db
    .select({ playerTag: users.playerTag, bannedAt: users.bannedAt })
    .from(users)
    .where(eq(users.id, userId));
  if (!user?.playerTag) throw new LfgError("Сначала привяжи аккаунт Brawl Stars", 400);
  if (user.bannedAt) throw new LfgError("Ты не можешь создавать заявки: аккаунт заблокирован модератором", 403);

  // --- Поля формы: только готовые варианты ---
  const mode = findMode(input.mode);
  const bracket = findBracket(input.bracket);
  const language = findLanguage(input.language);
  if (!mode || !bracket || !language) throw new LfgError("Выбери варианты из списка", 400);

  if (!Number.isInteger(input.playersNeeded) || input.playersNeeded < 1 || input.playersNeeded > mode.maxPlayers) {
    throw new LfgError(
      mode.maxPlayers === 1 ? "В этом режиме нужен только один напарник" : `Можно искать до ${mode.maxPlayers} игроков`,
      400,
    );
  }

  const brawlerIds = [...new Set(Array.isArray(input.brawlerIds) ? input.brawlerIds : [])];
  if (brawlerIds.length < 1 || brawlerIds.length > LFG_MAX_BRAWLERS) {
    throw new LfgError(`Выбери от 1 до ${LFG_MAX_BRAWLERS} бравлеров`, 400);
  }

  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  if (comment.length > LFG_COMMENT_MAX) {
    throw new LfgError(`Комментарий — не длиннее ${LFG_COMMENT_MAX} символов`, 400);
  }
  if (comment) {
    const check = checkComment(comment);
    if (!check.ok) throw new LfgError(check.reason, 400);
  }

  // --- Лимиты ---
  if (await getActivePost(userId)) {
    throw new LfgError("У тебя уже есть активная заявка. Закрой её, чтобы создать новую.", 409);
  }
  if ((await countPostsLast24h(userId)) >= LFG_DAILY_POST_LIMIT) {
    throw new LfgError(`Можно создавать не больше ${LFG_DAILY_POST_LIMIT} заявок в сутки. Попробуй завтра!`, 429);
  }

  // --- Данные игрока: трофеи и бравлеры берём из профиля, а не из формы ---
  const { profile } = await getPlayerProfile(user.playerTag);
  const owned = new Set(profile.brawlers.map((b) => b.id));
  if (!brawlerIds.every((id) => owned.has(id))) {
    throw new LfgError("Можно выбрать только своих бравлеров", 400);
  }

  try {
    const [post] = await db
      .insert(lfgPosts)
      .values({
        authorId: userId,
        playerTag: profile.tag,
        playerName: profile.name,
        authorTrophies: profile.trophies,
        mode: mode.id,
        brawlerIds,
        trophiesMin: bracket.min,
        trophiesMax: bracket.max,
        language: language.id,
        playersNeeded: input.playersNeeded,
        comment: comment || null,
        expiresAt: new Date(Date.now() + LFG_POST_TTL_MS),
      })
      .returning();
    return post;
  } catch (err) {
    // Две заявки одновременно (двойное нажатие) — вторую отклонит уникальный индекс базы.
    if (err instanceof Error && /lfg_posts_one_active_idx/.test(err.message + String(err.cause ?? ""))) {
      throw new LfgError("У тебя уже есть активная заявка", 409);
    }
    throw err;
  }
}

export type LfgPostRow = typeof lfgPosts.$inferSelect;

// Заявка в том виде, в каком её видит браузер.
export function toPublicPost(post: LfgPostRow) {
  return {
    id: post.id,
    playerTag: post.playerTag,
    playerName: post.playerName,
    authorTrophies: post.authorTrophies,
    mode: post.mode,
    brawlerIds: post.brawlerIds,
    trophiesMin: post.trophiesMin,
    trophiesMax: post.trophiesMax,
    language: post.language,
    playersNeeded: post.playersNeeded,
    comment: post.comment,
    createdAt: post.createdAt.toISOString(),
    expiresAt: post.expiresAt.toISOString(),
  };
}

export type PublicLfgPost = ReturnType<typeof toPublicPost>;

// ===================== Лента и действия с заявками =====================

export interface FeedFilters {
  mode?: string; // id режима или пусто — все
  bracket?: string; // трофеи автора
  language?: string;
  friendsOnly?: boolean; // только заявки моих друзей
}

// Активные заявки для ленты: без своих, без скрытых мной игроков, без заблокированных авторов.
export async function getFeed(viewerId: number, filters: FeedFilters) {
  const db = getDb();
  const now = new Date();
  const conditions = [
    eq(lfgPosts.status, "active"),
    gt(lfgPosts.expiresAt, now),
    ne(lfgPosts.authorId, viewerId),
    isNull(users.bannedAt),
    // Игроки, которых я скрыл, не показываются
    notExists(
      db
        .select({ one: sql`1` })
        .from(hiddenUsers)
        .where(and(eq(hiddenUsers.userId, viewerId), eq(hiddenUsers.hiddenUserId, lfgPosts.authorId))),
    ),
  ];

  const mode = filters.mode ? findMode(filters.mode) : undefined;
  // Заявки «Любой режим» подходят под любой фильтр режима.
  if (mode && mode.id !== "any") conditions.push(inArray(lfgPosts.mode, [mode.id, "any"]));

  const bracket = filters.bracket ? findBracket(filters.bracket) : undefined;
  if (bracket && bracket.id !== "any") {
    conditions.push(gte(lfgPosts.authorTrophies, bracket.min), lt(lfgPosts.authorTrophies, bracket.max));
  }

  const language = filters.language ? findLanguage(filters.language) : undefined;
  if (language) conditions.push(eq(lfgPosts.language, language.id));

  if (filters.friendsOnly) {
    // Автор — мой друг (дружба взаимная, направление заявки неважно).
    conditions.push(
      sql`exists (select 1 from ${friendships} where ${friendships.status} = 'accepted' and (
        (${friendships.requesterId} = ${viewerId} and ${friendships.addresseeId} = ${lfgPosts.authorId}) or
        (${friendships.addresseeId} = ${viewerId} and ${friendships.requesterId} = ${lfgPosts.authorId})))`,
    );
  }

  const rows = await db
    .select({
      post: lfgPosts,
      // Откликался ли я уже на эту заявку
      responded: sql<boolean>`exists (select 1 from ${lfgResponses} where ${lfgResponses.postId} = ${lfgPosts.id} and ${lfgResponses.responderId} = ${viewerId})`,
      reported: sql<boolean>`exists (select 1 from ${lfgReports} where ${lfgReports.postId} = ${lfgPosts.id} and ${lfgReports.reporterId} = ${viewerId})`,
      // Telegram автора — только если он сам включил показ в настройках.
      authorContact: sql<string | null>`case when ${privacySettings.showTelegramContact} then ${privacySettings.telegramUsername} end`,
    })
    .from(lfgPosts)
    .innerJoin(users, eq(users.id, lfgPosts.authorId))
    .leftJoin(privacySettings, eq(privacySettings.userId, lfgPosts.authorId))
    .where(and(...conditions))
    .orderBy(desc(lfgPosts.createdAt))
    .limit(50);

  return rows.map((r) => ({
    ...toPublicPost(r.post),
    responded: r.responded,
    reported: r.reported,
    authorContact: r.authorContact,
  }));
}

export type FeedPost = Awaited<ReturnType<typeof getFeed>>[number];

// Автор закрывает свою заявку.
export async function closePost(userId: number, postId: number) {
  const closed = await getDb()
    .update(lfgPosts)
    .set({ status: "closed" })
    .where(and(eq(lfgPosts.id, postId), eq(lfgPosts.authorId, userId), eq(lfgPosts.status, "active")))
    .returning({ id: lfgPosts.id });
  if (closed.length === 0) throw new LfgError("Эту заявку нельзя закрыть: она уже неактивна или не твоя", 404);
  scheduleRemoval([postId]);
}

// Заявка, с которой можно взаимодействовать (активная, не своя, автор не заблокирован).
async function getOthersActivePost(userId: number, postId: number) {
  const [row] = await getDb()
    .select({ post: lfgPosts, authorBanned: users.bannedAt })
    .from(lfgPosts)
    .innerJoin(users, eq(users.id, lfgPosts.authorId))
    .where(eq(lfgPosts.id, postId));
  if (!row || row.post.status !== "active" || row.post.expiresAt < new Date() || row.authorBanned) {
    throw new LfgError("Эта заявка уже неактивна", 404);
  }
  if (row.post.authorId === userId) throw new LfgError("Это твоя заявка", 400);
  return row.post;
}

const isUniqueViolation = (err: unknown, index: string) =>
  err instanceof Error && (err.message + String(err.cause ?? "")).includes(index);

// «Я в деле». Уведомление автору через бота добавляется в задаче 7.
export async function respondToPost(userId: number, postId: number) {
  const db = getDb();
  const [me] = await db
    .select({ playerTag: users.playerTag, bannedAt: users.bannedAt })
    .from(users)
    .where(eq(users.id, userId));
  if (!me?.playerTag) throw new LfgError("Сначала привяжи аккаунт Brawl Stars", 400);
  if (me.bannedAt) throw new LfgError("Аккаунт заблокирован модератором", 403);

  const post = await getOthersActivePost(userId, postId);

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recent] = await db
    .select({ n: count() })
    .from(lfgResponses)
    .where(and(eq(lfgResponses.responderId, userId), gt(lfgResponses.createdAt, hourAgo)));
  if ((recent?.n ?? 0) >= LFG_HOURLY_RESPONSE_LIMIT) {
    throw new LfgError(`Не больше ${LFG_HOURLY_RESPONSE_LIMIT} откликов в час. Передохни немного!`, 429);
  }

  try {
    await db.insert(lfgResponses).values({ postId: post.id, responderId: userId });
  } catch (err) {
    if (isUniqueViolation(err, "lfg_responses_once_idx")) {
      throw new LfgError("Ты уже откликнулся на эту заявку", 409);
    }
    throw err;
  }
  return { post, responderTag: me.playerTag };
}

// Сколько разных людей должны пожаловаться, чтобы заявка скрылась до проверки.
export const REPORTS_TO_HIDE = 3;

export async function reportPost(userId: number, postId: number, reason: ReportReason) {
  const db = getDb();
  const post = await getOthersActivePost(userId, postId);
  try {
    await db.insert(lfgReports).values({ postId: post.id, reporterId: userId, reason });
  } catch (err) {
    if (isUniqueViolation(err, "lfg_reports_once_idx")) {
      throw new LfgError("Ты уже пожаловался на эту заявку", 409);
    }
    throw err;
  }

  // Каждая жалоба — от разного человека (уникальный индекс), поэтому достаточно посчитать.
  const [reports] = await db.select({ n: count() }).from(lfgReports).where(eq(lfgReports.postId, post.id));
  if ((reports?.n ?? 0) >= REPORTS_TO_HIDE) {
    await db
      .update(lfgPosts)
      .set({ status: "hidden" })
      .where(and(eq(lfgPosts.id, post.id), eq(lfgPosts.status, "active")));
    // Скрыта до проверки — убираем и из канала.
    scheduleRemoval([post.id]);
  }
}

// «Скрыть игрока»: больше не показывать мне заявки автора этой заявки.
export async function hideAuthor(userId: number, postId: number) {
  const db = getDb();
  const [post] = await db.select({ authorId: lfgPosts.authorId }).from(lfgPosts).where(eq(lfgPosts.id, postId));
  if (!post) throw new LfgError("Заявка не найдена", 404);
  if (post.authorId === userId) throw new LfgError("Себя скрыть нельзя", 400);
  await db.insert(hiddenUsers).values({ userId, hiddenUserId: post.authorId }).onConflictDoNothing();
}
