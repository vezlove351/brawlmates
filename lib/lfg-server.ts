import { and, count, desc, eq, gt, lt } from "drizzle-orm";
import { getDb } from "./db";
import { lfgPosts, users } from "./db/schema";
import {
  findBracket,
  findLanguage,
  findMode,
  LFG_COMMENT_MAX,
  LFG_DAILY_POST_LIMIT,
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
  await getDb()
    .update(lfgPosts)
    .set({ status: "expired" })
    .where(
      and(eq(lfgPosts.authorId, authorId), eq(lfgPosts.status, "active"), lt(lfgPosts.expiresAt, new Date())),
    );
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
