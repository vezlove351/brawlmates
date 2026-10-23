// Одноразовая настройка бота: говорим Telegram, куда слать сообщения (вебхук),
// и ставим кнопку «Открыть» в меню чата.
//
// Запуск:  npm run set-webhook -- https://brawlmates.vercel.app
// Токен берётся из .env.local (TELEGRAM_BOT_TOKEN).

import { createHash } from "node:crypto";

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = (process.argv[2] ?? process.env.APP_URL ?? "").replace(/\/$/, "");

if (!token) {
  console.error("Нет TELEGRAM_BOT_TOKEN. Положи его в .env.local или выполни `vercel env pull .env.local`.");
  process.exit(1);
}
if (!appUrl.startsWith("https://")) {
  console.error("Укажи адрес приложения: npm run set-webhook -- https://твой-домен.vercel.app");
  process.exit(1);
}

// Тот же секрет, что и в lib/bot.ts.
const secret = createHash("sha256").update(token).digest("hex");

async function callTelegram(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log(`${method}:`, data.ok ? "ok" : data.description);
  if (!data.ok) process.exit(1);
}

await callTelegram("setWebhook", {
  url: `${appUrl}/api/bot`,
  secret_token: secret,
  // message — команды боту, callback_query — нажатия кнопок «Буду» / «Не смогу».
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: true,
});

await callTelegram("setChatMenuButton", {
  menu_button: { type: "web_app", text: "Открыть", web_app: { url: appUrl } },
});

await callTelegram("setMyCommands", {
  commands: [{ command: "start", description: "Открыть Brawlmates" }],
});

console.log("Готово! Напиши боту /start.");
