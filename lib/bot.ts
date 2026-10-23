import { createHash } from "node:crypto";
import { Bot, InlineKeyboard } from "grammy";
import { inviteMessageFor } from "./game-notify";
import { LfgError } from "./lfg-server";
import { answerGame } from "./team-games";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная окружения ${name}`);
  return value;
}

// Адрес мини-приложения. На Vercel берём домен продакшена автоматически,
// APP_URL нужен только если хочется указать адрес вручную (например, для туннеля).
export function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  throw new Error("Не удалось определить адрес приложения: задай APP_URL");
}

// Секрет для вебхука: Telegram присылает его в заголовке каждого запроса,
// так мы отличаем настоящие запросы от поддельных. Выводим его из токена бота,
// чтобы не заводить ещё одну переменную окружения.
export function getWebhookSecret(): string {
  return createHash("sha256").update(requireEnv("TELEGRAM_BOT_TOKEN")).digest("hex");
}

let bot: Bot | undefined;

// Бот создаётся при первом запросе, а не при сборке — иначе `npm run build`
// падал бы без токена.
export function getBot(): Bot {
  if (bot) return bot;

  bot = new Bot(requireEnv("TELEGRAM_BOT_TOKEN"));

  bot.command("start", async (ctx) => {
    const keyboard = new InlineKeyboard().webApp("Открыть приложение", getAppUrl());
    await ctx.reply(
      "Привет! Это Brawlmates — твой профиль Brawl Stars прямо в Telegram.",
      { reply_markup: keyboard },
    );
  });

  // Кнопки «Буду» / «Не смогу» в приглашении на игру команды.
  bot.callbackQuery(/^game:(\d+):(yes|no)$/, async (ctx) => {
    const gameId = Number(ctx.match[1]);
    const answer = ctx.match[2] === "yes" ? "yes" : "no";
    try {
      // answerGame сам проверяет, что нажавший — участник этой команды.
      await answerGame(ctx.from.id, gameId, answer);
      // Ответ на нажатие может не дойти (например, если прошло слишком много времени) — это не страшно.
      await ctx
        .answerCallbackQuery({ text: answer === "yes" ? "Записал: ты будешь ✅" : "Записал: не сможешь" })
        .catch(() => {});
      const message = await inviteMessageFor(gameId, ctx.from.id);
      if (message) await ctx.editMessageText(message.text, { reply_markup: message.reply_markup }).catch(() => {});
    } catch (err) {
      await ctx
        .answerCallbackQuery({
          text: err instanceof LfgError ? err.message : "Не получилось, попробуй в приложении",
          show_alert: true,
        })
        .catch(() => {});
    }
  });

  bot.catch((err) => {
    // Логируем только описание ошибки, без данных запроса и токенов.
    console.error("Ошибка бота:", err.error instanceof Error ? err.error.message : err.error);
  });

  return bot;
}
