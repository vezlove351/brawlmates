import { bigint, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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

export type User = typeof users.$inferSelect;
