// Проверка фильтра комментариев: npm run check-moderation
// Плохие примеры должны отклоняться, обычные фразы — проходить.

import { checkComment } from "../lib/moderation.ts";

const shouldBlock = [
  "ты лох и сука", "х.у.й", "нахуй", "пиздец", "заебал", "бля буду", "сууука", "еб*ть", "xyй",
  "fuck you", "go t.me/xxx", "пиши @vasya_pro", "мой номер 8 916 123 45 67", "заходи на mysite.ru",
];
const shouldPass = [
  "ищу тиммейта на мортиса", "страхуем друг друга", "оскорбляю? нет", "употребляю тактику",
  "себе возьми шелли", "победа будет наша", "небо голубое", "сукно", "требую пушить",
  "ребята играем", "учебная игра", "погребок", "хуже не будет", "художник", "пушим до 1000",
  "11 силы у всех", "скидка 50%",
];

let failed = 0;
for (const text of shouldBlock) {
  if (checkComment(text).ok) {
    failed++;
    console.log(`✗ пропущено: «${text}»`);
  }
}
for (const text of shouldPass) {
  const result = checkComment(text);
  if (!result.ok) {
    failed++;
    console.log(`✗ ложное срабатывание: «${text}» — ${result.reason}`);
  }
}

console.log(
  failed === 0
    ? `✓ Все ${shouldBlock.length + shouldPass.length} примеров обработаны правильно.`
    : `Ошибок: ${failed}`,
);
process.exit(failed === 0 ? 0 : 1);
