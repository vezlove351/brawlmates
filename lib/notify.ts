import { eq } from "drizzle-orm";
import { getBot } from "./bot";
import { getDb } from "./db";
import { users } from "./db/schema";
import { formatNumber } from "./format";
import { findMode } from "./lfg";
import { FRIENDS_APP_LINK, profileLink } from "./links";
import { getPlayerProfile } from "./profile";
import { getAllowedContact } from "./settings-server";
import { teamInviteLink } from "./teams";

interface ResponseNotice {
  authorId: number;
  postMode: string;
  responderId: number;
  responderTag: string;
}

// Сообщение автору заявки: «Кто-то в деле!».
// Telegram откликнувшегося — только если он сам разрешил это в настройках.
export async function notifyAuthorAboutResponse(notice: ResponseNotice) {
  const [{ profile }, contact] = await Promise.all([
    getPlayerProfile(notice.responderTag),
    getAllowedContact(notice.responderId),
  ]);
  const mode = findMode(notice.postMode);

  const lines = [
    `🤝 На твою заявку «${mode?.emoji ?? ""} ${mode?.label ?? notice.postMode}» откликнулись!`,
    "",
    `Игрок: ${profile.name}`,
    `Трофеи: 🏆 ${formatNumber(profile.trophies)}`,
    `Тег: ${profile.tag}`,
    "",
    contact
      ? `Telegram: @${contact}`
      : "Добавь его в друзья в игре: Друзья → Добавить друга → вставь тег.",
  ];

  // Обычный текст без разметки — ник игрока может содержать любые символы.
  await getBot().api.sendMessage(notice.authorId, lines.join("\n"), {
    reply_markup: {
      inline_keyboard: [[{ text: "Открыть профиль", url: profileLink(profile.tag) }]],
    },
  });
}

// Ник и трофеи игрока для текста уведомлений.
async function playerLine(userId: number): Promise<string | null> {
  const [user] = await getDb().select({ tag: users.playerTag }).from(users).where(eq(users.id, userId));
  if (!user?.tag) return null;
  const { profile } = await getPlayerProfile(user.tag);
  return `${profile.name} (🏆 ${formatNumber(profile.trophies)})`;
}

// «Тебя хотят добавить в друзья» / «Твою заявку приняли».
export async function notifyFriend(targetId: number, fromId: number, kind: "request" | "accepted") {
  const who = await playerLine(fromId);
  if (!who) return;
  const text =
    kind === "request"
      ? `👋 ${who} хочет добавить тебя в друзья в Brawlmates.`
      : `✅ ${who} теперь твой друг в Brawlmates!`;
  await getBot().api.sendMessage(targetId, text, {
    reply_markup: {
      inline_keyboard: [[{ text: kind === "request" ? "Открыть заявки" : "Открыть друзей", url: FRIENDS_APP_LINK }]],
    },
  });
}

// Приглашение в команду от друга.
export async function notifyTeamInvite(
  targetId: number,
  fromId: number,
  invite: { code: string; teamName: string; emblem: string },
) {
  const who = await playerLine(fromId);
  if (!who) return;
  await getBot().api.sendMessage(
    targetId,
    `${invite.emblem} ${who} зовёт тебя в команду «${invite.teamName}» в Brawlmates.

Приглашение действует 24 часа.`,
    { reply_markup: { inline_keyboard: [[{ text: "Посмотреть приглашение", url: teamInviteLink(invite.code) }]] } },
  );
}

// Решение модератора по совету — автору.
export async function notifyTipDecision(authorId: number, approved: boolean) {
  const text = approved
    ? "💡 Твой совет прошёл проверку и опубликован в Brawlmates. Спасибо, что делишься опытом!"
    : "💡 Твой совет не прошёл проверку. Попробуй написать по-другому: коротко, по делу и без лишнего.";
  await getBot().api.sendMessage(authorId, text);
}
