import type { InlineKeyboardMarkup } from "grammy/types";
import { getBot } from "./bot";
import type { GameAnswer } from "./db/schema";
import { FRIENDS_APP_LINK } from "./links";
import { formatGameTime, gameRecipients, REMINDER_MINUTES } from "./team-games";

type Info = NonNullable<Awaited<ReturnType<typeof gameRecipients>>>;
type Member = Info["members"][number];

const logError = (what: string) => (err: unknown) =>
  console.error(`Игры: ${what}:`, err instanceof Error ? err.message : err);

const ANSWER_LABEL: Record<GameAnswer, string> = { yes: "✅ Буду", no: "❌ Не смогу" };

// Кнопки «Буду» / «Не смогу» прямо в чате + открыть команду в приложении.
function answerKeyboard(gameId: number): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "✅ Буду", callback_data: `game:${gameId}:yes` },
        { text: "❌ Не смогу", callback_data: `game:${gameId}:no` },
      ],
      [{ text: "Открыть команду", url: FRIENDS_APP_LINK }],
    ],
  };
}

// Текст приглашения для конкретного участника — время по его часовому поясу.
export function inviteText(info: Info, member: Member): string {
  const captain = info.members.find((m) => m.userId === info.game.createdBy);
  const lines = [
    `🎮 ${info.team.emblem} «${info.team.name}»: ${captain ? `${captain.name} зовёт` : "команда зовёт"} играть ${formatGameTime(info.game.startsAt, member.timeZone)}.`,
    "",
    member.answer ? `Твой ответ: ${ANSWER_LABEL[member.answer]} (можно поменять)` : "Будешь?",
  ];
  return lines.join("\n");
}

// Разослать приглашение всем, кроме капитана.
export async function sendGameInvites(gameId: number) {
  const info = await gameRecipients(gameId);
  if (!info) return;
  for (const member of info.members) {
    if (member.userId === info.game.createdBy) continue;
    await getBot()
      .api.sendMessage(member.userId, inviteText(info, member), { reply_markup: answerKeyboard(gameId) })
      .catch(logError(`не удалось пригласить ${member.userId}`));
  }
}

// После нажатия кнопки — обновить сообщение у этого участника.
export async function inviteMessageFor(gameId: number, userId: number) {
  const info = await gameRecipients(gameId);
  const member = info?.members.find((m) => m.userId === userId);
  if (!info || !member) return null;
  return { text: inviteText(info, member), reply_markup: answerKeyboard(gameId) };
}

export async function sendGameCancelled(gameId: number) {
  const info = await gameRecipients(gameId);
  if (!info) return;
  for (const member of info.members) {
    if (member.userId === info.game.createdBy) continue;
    await getBot()
      .api.sendMessage(
        member.userId,
        `❌ Игра команды ${info.team.emblem} «${info.team.name}» ${formatGameTime(info.game.startsAt, member.timeZone)} отменена.`,
      )
      .catch(logError(`не удалось сообщить об отмене ${member.userId}`));
  }
}

// Напоминание за 15 минут — только тем, кто ответил «Буду».
export async function sendGameReminder(gameId: number) {
  const info = await gameRecipients(gameId);
  if (!info) return;
  const coming = info.members.filter((m) => m.answer === "yes");
  const names = coming.map((m) => m.name).join(", ");
  for (const member of coming) {
    await getBot()
      .api.sendMessage(
        member.userId,
        [
          `⏰ Скоро игра! ${info.team.emblem} «${info.team.name}» — ${formatGameTime(info.game.startsAt, member.timeZone)}.`,
          `Будут: ${names}.`,
          "",
          "Заходи в Brawl Stars и зови команду в лобби 🎮",
        ].join("\n"),
      )
      .catch(logError(`не удалось напомнить ${member.userId}`));
  }
}

export { REMINDER_MINUTES };
