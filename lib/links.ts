// Ссылки на мини-приложение. Можно использовать и на сервере, и в браузере.

export const BOT_USERNAME = "Brawlmates_bot";
// Короткое имя мини-приложения, заданное в @BotFather через /newapp.
export const APP_SHORT_NAME = "app";

// Ссылка, открывающая профиль игрока: t.me/Brawlmates_bot/app?startapp=p_ABC123
export function profileLink(tag: string): string {
  return `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}?startapp=p_${tag.replace(/^#/, "")}`;
}

// Разбирает параметр startapp. "p_ABC123" → "#ABC123", иначе null.
export function parseProfileStartParam(startParam: string | undefined): string | null {
  const match = startParam?.match(/^p_([0289PYLQGRJCUV]{3,14})$/i);
  return match ? `#${match[1].toUpperCase()}` : null;
}
