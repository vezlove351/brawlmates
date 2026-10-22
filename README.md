# Brawlmates

Telegram Mini App для игроков Brawl Stars. Подробности — в [CLAUDE.md](CLAUDE.md).

## Что где лежит

| Файл | Что делает |
| --- | --- |
| `app/page.tsx` | Главная страница: «Привет, {имя}!» |
| `components/TelegramProvider.tsx` | Подключение к Telegram: тема, данные пользователя |
| `app/globals.css` | Цвета из темы Telegram (`bg-tg-bg`, `text-tg-hint` и т.д.) |
| `lib/bot.ts` | Бот на grammY: команда `/start` с кнопкой «Открыть приложение» |
| `app/api/bot/route.ts` | Вебхук: сюда Telegram присылает сообщения боту |
| `scripts/set-webhook.mjs` | Одноразовая настройка вебхука и кнопки меню |
| `lib/telegram-auth.ts` | Проверка подписи initData (вход через Telegram) |
| `app/api/auth/route.ts` | Вход: проверка initData и создание пользователя |
| `lib/db/schema.ts` | Таблицы базы данных (Drizzle) |
| `scripts/check-auth.ts` | Демонстрация: подделанный initData не проходит |

## Деплой (первый раз)

1. Залить код на GitHub: `git push -u origin main`.
2. На [vercel.com](https://vercel.com) → **Add New → Project** → импортировать репозиторий `brawlmates`.
   (Или в терминале: `npm i -g vercel`, `vercel login`, `vercel link`.)
3. В **Settings → Environment Variables** проверить, что есть `TELEGRAM_BOT_TOKEN`
   (остальные переменные понадобятся в следующих задачах).
4. Дождаться деплоя и скопировать адрес, например `https://brawlmates.vercel.app`.
5. Связать бота с приложением (один раз):
   ```bash
   vercel env pull .env.local          # скачать переменные локально (или создать .env.local вручную)
   npm run set-webhook -- https://brawlmates.vercel.app
   ```
6. Открыть бота в Telegram → `/start` → «Открыть приложение».

Дальше каждый `git push` в `main` деплоится автоматически.

## Локальная разработка

```bash
npm install
npm run dev     # http://localhost:3000 — вне Telegram покажет подсказку открыть через бота
npm run build   # проверка, что всё собирается
```

## База данных

```bash
npm run db:generate   # после изменения lib/db/schema.ts — создать миграцию
npm run db:migrate    # применить миграции к базе
npm run db:studio     # посмотреть таблицы в браузере
```

## Проверка входа

```bash
npm run check-auth -- https://brawlmates.vercel.app
```
