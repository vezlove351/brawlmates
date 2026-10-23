import { getBot } from "./bot";
import { formatNumber } from "./format";
import { findMode } from "./lfg";
import { profileLink } from "./links";
import { getPlayerProfile } from "./profile";
import { getAllowedContact } from "./settings-server";

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
