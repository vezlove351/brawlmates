import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { after } from "next/server";
import { getBot } from "./bot";
import { getDb } from "./db";
import { lfgPosts, playerProfiles } from "./db/schema";
import { formatNumber } from "./format";
import { bracketLabel, findLanguage, findMode } from "./lfg";
import { LFG_APP_LINK, LFG_CHANNEL } from "./links";

// Канал @brawlmate_app — «живая доска» заявок: пост появляется при создании заявки
// и удаляется, как только заявка перестала быть активной.
// Telegram автора в канал не попадает никогда — канал публичный.

const titleCase = (name: string) => name.toLowerCase().replace(/(^|[\s-])\S/g, (s) => s.toUpperCase());

const logError = (what: string) => (err: unknown) =>
  console.error(`Канал: ${what}:`, err instanceof Error ? err.message : err);

// Публикует активную заявку в канал и запоминает номер поста.
export async function publishToChannel(postId: number) {
  const db = getDb();
  const [post] = await db.select().from(lfgPosts).where(eq(lfgPosts.id, postId));
  if (!post || post.status !== "active" || post.channelMessageId) return;

  // Имена бравлеров берём из кеша профиля автора.
  const [cached] = await db
    .select({ data: playerProfiles.data })
    .from(playerProfiles)
    .where(eq(playerProfiles.tag, post.playerTag));
  const names = post.brawlerIds.map((id) => {
    const b = cached?.data.brawlers?.find((x) => x.id === id);
    return b ? titleCase(b.name) : null;
  });

  const mode = findMode(post.mode);
  const lines = [
    `🔎 Ищу тиммейта — ${mode?.emoji ?? ""} ${mode?.label ?? post.mode}`,
    "",
    `👤 ${post.playerName} · 🏆 ${formatNumber(post.authorTrophies)}`,
    names.some(Boolean) ? `🎮 Играю: ${names.filter(Boolean).join(", ")}` : null,
    `👥 Нужно игроков: ${post.playersNeeded}`,
    `🏆 Трофеи тиммейта: ${bracketLabel(post.trophiesMin, post.trophiesMax)}`,
    `🌐 ${findLanguage(post.language)?.label ?? post.language}`,
    post.comment ? `💬 ${post.comment}` : null,
    "",
    "⏳ Заявка активна 2 часа",
  ].filter((l) => l !== null);

  // Обычный текст без разметки — ник и комментарий могут содержать любые символы.
  const message = await getBot().api.sendMessage(LFG_CHANNEL, lines.join("\n"), {
    reply_markup: { inline_keyboard: [[{ text: "🤝 Откликнуться", url: LFG_APP_LINK }]] },
    link_preview_options: { is_disabled: true },
  });

  await db.update(lfgPosts).set({ channelMessageId: message.message_id }).where(eq(lfgPosts.id, postId));
}

// Удаляет посты из канала по их номерам.
export async function deleteChannelMessages(messageIds: number[]) {
  for (const id of messageIds) {
    // Пост могли уже удалить вручную — это не ошибка.
    await getBot().api.deleteMessage(LFG_CHANNEL, id).catch(logError(`не удалось удалить пост ${id}`));
  }
}

// Убирает из канала посты этих заявок (если они там есть).
export async function removePostsFromChannel(postIds: number[]) {
  if (postIds.length === 0) return;
  const db = getDb();
  const rows = await db
    .select({ id: lfgPosts.id, messageId: lfgPosts.channelMessageId })
    .from(lfgPosts)
    .where(and(inArray(lfgPosts.id, postIds), isNotNull(lfgPosts.channelMessageId)));
  if (rows.length === 0) return;

  await deleteChannelMessages(rows.map((r) => r.messageId!));
  await db
    .update(lfgPosts)
    .set({ channelMessageId: null })
    .where(inArray(lfgPosts.id, rows.map((r) => r.id)));
}

// Запланировать публикацию/удаление после ответа — чтобы пользователь не ждал Telegram.
export function schedulePublish(postId: number) {
  after(() => publishToChannel(postId).catch(logError(`не удалось опубликовать заявку ${postId}`)));
}

export function scheduleRemoval(postIds: number[]) {
  if (postIds.length === 0) return;
  after(() => removePostsFromChannel(postIds).catch(logError("не удалось убрать заявки")));
}
