import {
  bigint,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { PlayerProfile } from "../brawlstars";

// Пользователь = Telegram-аккаунт. Храним минимум данных.
export const users = pgTable("users", {
  // id из Telegram. Числа там до 2^52, поэтому mode: "number" безопасен.
  id: bigint("id", { mode: "number" }).primaryKey(),
  firstName: text("first_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Привязанный тег Brawl Stars (после подтверждения владения). Один тег — один пользователь.
  playerTag: text("player_tag").unique(),
});

// Незавершённая привязка тега: какую иконку мы попросили поставить.
// У пользователя одновременно максимум одна заявка.
export const tagLinkRequests = pgTable("tag_link_requests", {
  userId: bigint("user_id", { mode: "number" })
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  playerTag: text("player_tag").notNull(),
  iconId: integer("icon_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// Кеш профилей из Brawl Stars API: не дёргаем API чаще раза в 5 минут на игрока.
export const playerProfiles = pgTable("player_profiles", {
  tag: text("tag").primaryKey(),
  data: jsonb("data").$type<PlayerProfile>().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
});

// Бои игроков. Battlelog отдаёт только последние 25 боёв, поэтому крон регулярно
// сохраняет новые сюда. Дубликаты отсекаем по (тег игрока + время боя).
export const battles = pgTable(
  "battles",
  {
    id: serial("id").primaryKey(),
    playerTag: text("player_tag").notNull(),
    battleTime: timestamp("battle_time", { withTimezone: true }).notNull(),
    mode: text("mode").notNull(),
    map: text("map"),
    type: text("type"),
    // "victory" | "defeat" | "draw"; в «Столкновении» результата нет — там место (rank)
    result: text("result"),
    rank: integer("rank"),
    trophyChange: integer("trophy_change"),
    brawlerId: integer("brawler_id"),
  },
  (t) => [uniqueIndex("battles_player_time_idx").on(t.playerTag, t.battleTime)],
);

// Трофеи игрока по дням — для графика. Одна запись на игрока в день (последнее значение).
export const trophyHistory = pgTable(
  "trophy_history",
  {
    playerTag: text("player_tag").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    trophies: integer("trophies").notNull(),
  },
  (t) => [primaryKey({ columns: [t.playerTag, t.day] })],
);

export type User = typeof users.$inferSelect;
export type BattleRow = typeof battles.$inferSelect;
