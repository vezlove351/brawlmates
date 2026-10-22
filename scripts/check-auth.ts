// Проверка: можно ли подделать initData?
//
//   npm run check-auth                                    — проверить функцию проверки
//   npm run check-auth -- https://brawlmates.vercel.app  — ещё и живой сервер
//
// Скрипт сам «играет за Telegram»: подписывает данные секретным токеном,
// а потом пробует разные подделки. Реальный токен бота не нужен и не используется.

import { createHmac, randomBytes } from "node:crypto";
import { validateInitData } from "../lib/telegram-auth.ts";

// Подписывает данные так же, как это делает Telegram.
function sign(fields: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const realToken = `123456:${randomBytes(24).toString("hex")}`; // «настоящий» токен бота
const hackerToken = `123456:${randomBytes(24).toString("hex")}`; // хакер токена не знает

const now = Math.floor(Date.now() / 1000);
const fields = {
  auth_date: String(now),
  query_id: "AAE1",
  user: JSON.stringify({ id: 777, first_name: "Лёва" }),
};
const genuine = sign(fields, realToken);

const cases: { name: string; initData: string; shouldPass: boolean }[] = [
  { name: "Настоящие данные от Telegram", initData: genuine, shouldPass: true },
  {
    name: "Подменили имя, подпись оставили",
    initData: genuine.replace(encodeURIComponent("Лёва"), encodeURIComponent("Админ")),
    shouldPass: false,
  },
  {
    name: "Подменили id, чтобы войти за другого",
    initData: genuine.replace("777", "1"),
    shouldPass: false,
  },
  { name: "Подписали своим (чужим) токеном", initData: sign(fields, hackerToken), shouldPass: false },
  {
    name: "Убрали подпись",
    initData: new URLSearchParams(fields).toString(),
    shouldPass: false,
  },
  {
    name: "Старые данные (2 дня назад)",
    initData: sign({ ...fields, auth_date: String(now - 2 * 24 * 3600) }, realToken),
    shouldPass: false,
  },
];

let failed = 0;
console.log("1) Функция проверки подписи:\n");
for (const c of cases) {
  const result = validateInitData(c.initData, realToken);
  const correct = result.ok === c.shouldPass;
  if (!correct) failed++;
  const verdict = result.ok ? "ПРИНЯТО" : `отклонено (${result.reason})`;
  console.log(`  ${correct ? "✓" : "✗ ОШИБКА"}  ${c.name}: ${verdict}`);
}

// Живой сервер: шлём подделку (сервер не знает наш тестовый токен, так что для него
// все эти данные — подделка) и ждём ответ 401.
const baseUrl = process.argv[2];
if (baseUrl) {
  console.log(`\n2) Живой сервер ${baseUrl}:\n`);
  const attempts: { name: string; headers: Record<string, string> }[] = [
    { name: "Без данных входа", headers: {} },
    { name: "Мусор вместо initData", headers: { authorization: "tma hello" } },
    { name: "Правдоподобная подделка", headers: { authorization: `tma ${genuine}` } },
  ];
  for (const a of attempts) {
    const res = await fetch(`${baseUrl}/api/auth`, { method: "POST", headers: a.headers });
    const correct = res.status === 401;
    if (!correct) failed++;
    console.log(`  ${correct ? "✓" : "✗ ОШИБКА"}  ${a.name}: ответ ${res.status}`);
  }
}

console.log(failed === 0 ? "\nВсё в порядке: подделки не проходят." : `\nПроблем: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
