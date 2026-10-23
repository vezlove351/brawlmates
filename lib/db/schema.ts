import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
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
  // Заблокирован модератором: не может создавать заявки и откликаться.
  bannedAt: timestamp("banned_at", { withTimezone: true }),
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

// ===================== LFG: поиск тиммейтов =====================

// Настройки приватности. Если строки нет — действуют значения по умолчанию (всё скрыто).
export const privacySettings = pgTable("privacy_settings", {
  userId: bigint("user_id", { mode: "number" })
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // Показывать ли мой Telegram (@username) в заявках и откликах. По умолчанию — нет.
  showTelegramContact: boolean("show_telegram_contact").notNull().default(false),
  // @username храним, только пока показ включён (минимум данных).
  telegramUsername: text("telegram_username"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LfgStatus = "active" | "closed" | "expired" | "hidden" | "removed";

// Заявки «ищу тиммейта». Живут 2 часа; у игрока максимум одна активная.
export const lfgPosts = pgTable(
  "lfg_posts",
  {
    id: serial("id").primaryKey(),
    authorId: bigint("author_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Снимок данных автора на момент создания — чтобы лента не ходила в API.
    playerTag: text("player_tag").notNull(),
    playerName: text("player_name").notNull(),
    authorTrophies: integer("author_trophies").notNull(),
    // Что ищем — только готовые варианты из формы.
    mode: text("mode").notNull(),
    brawlerIds: integer("brawler_ids").array().notNull(),
    trophiesMin: integer("trophies_min").notNull(),
    trophiesMax: integer("trophies_max").notNull(),
    language: text("language").notNull(),
    playersNeeded: integer("players_needed").notNull(),
    // Необязательный комментарий до 80 символов (проверяется на мат и ссылки).
    comment: text("comment"),
    // active — в ленте; closed — автор закрыл; expired — прошло 2 часа;
    // hidden — скрыта после 3 жалоб до проверки; removed — удалена модератором.
    status: text("status").$type<LfgStatus>().notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    // База сама не даст создать вторую активную заявку.
    uniqueIndex("lfg_posts_one_active_idx").on(t.authorId).where(sql`${t.status} = 'active'`),
    // Для ленты: активные заявки по времени истечения.
    index("lfg_posts_feed_idx").on(t.status, t.expiresAt),
    // Для лимита «5 заявок в сутки».
    index("lfg_posts_author_created_idx").on(t.authorId, t.createdAt),
  ],
);

// Отклики «Я в деле». Один отклик на заявку от одного человека.
export const lfgResponses = pgTable(
  "lfg_responses",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => lfgPosts.id, { onDelete: "cascade" }),
    responderId: bigint("responder_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("lfg_responses_once_idx").on(t.postId, t.responderId),
    // Для лимита «20 откликов в час».
    index("lfg_responses_responder_created_idx").on(t.responderId, t.createdAt),
  ],
);

export type ReportReason = "rude" | "spam" | "scam" | "other";
export type ReportResolution = "kept" | "removed" | "banned";

// Жалобы на заявки. Один человек — одна жалоба на заявку,
// поэтому «3 жалобы» всегда значит «3 разных человека».
export const lfgReports = pgTable(
  "lfg_reports",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => lfgPosts.id, { onDelete: "cascade" }),
    reporterId: bigint("reporter_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").$type<ReportReason>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Решение модератора: пусто — ещё не проверено.
    resolution: text("resolution").$type<ReportResolution>(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("lfg_reports_once_idx").on(t.postId, t.reporterId)],
);

// Скрытые игроки: «не показывай мне заявки этого человека».
export const hiddenUsers = pgTable(
  "hidden_users",
  {
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    hiddenUserId: bigint("hidden_user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.hiddenUserId] })],
);

export type User = typeof users.$inferSelect;
export type BattleRow = typeof battles.$inferSelect;
