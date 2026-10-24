import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
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
  // Часовой пояс телефона (например, "Europe/Lisbon") — чтобы писать время игр по-местному.
  timeZone: text("time_zone"),
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
    // Теги сокомандников в этом бою (без самого игрока). Пусто — бой сохранён до появления поля.
    teammates: text("teammates").array(),
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
  // Принимать заявки в друзья. По умолчанию — да, от всех в Brawlmates.
  acceptFriendRequests: boolean("accept_friend_requests").notNull().default(true),
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
    // Номер поста в канале @brawlmate_app — чтобы удалить пост, когда заявка неактивна.
    channelMessageId: integer("channel_message_id"),
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

// Кеш рейтингов Brawl Stars (мировой и по странам) — обновляем не чаще раза в 10 минут.
export const rankingsCache = pgTable("rankings_cache", {
  // "global" или код страны: "RU", "UA", ...
  key: text("key").primaryKey(),
  data: jsonb("data").$type<RankingEntry[]>().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
});

export interface RankingEntry {
  rank: number;
  tag: string;
  name: string;
  iconId: number;
  trophies: number;
  club: string | null;
}

// ===================== Этап 3: друзья =====================

// pending — заявка ждёт ответа; accepted — вы друзья;
// declined — отклонена (для отправителя выглядит как «отправлена», повторно отправить нельзя).
export type FriendshipStatus = "pending" | "accepted" | "declined";

// Дружба между двумя пользователями. Одна строка на пару — неважно, кто кому написал.
export const friendships = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    requesterId: bigint("requester_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: bigint("addressee_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").$type<FriendshipStatus>().notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    // Одна пара — одна строка: A→B и B→A считаются одной и той же дружбой.
    uniqueIndex("friendships_pair_idx").on(
      sql`least(${t.requesterId}, ${t.addresseeId})`,
      sql`greatest(${t.requesterId}, ${t.addresseeId})`,
    ),
    // Нельзя дружить с самим собой.
    check("friendships_not_self", sql`${t.requesterId} <> ${t.addresseeId}`),
    // Входящие заявки и лимит «20 исходящих в сутки».
    index("friendships_addressee_idx").on(t.addresseeId, t.status),
    index("friendships_requester_created_idx").on(t.requesterId, t.createdAt),
  ],
);

// ===================== Этап 3: команды =====================

// Команда до 3 игроков. Эмблема — ключ из готового набора (lib/teams.ts).
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  emblem: text("emblem").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TeamRole = "captain" | "member";

// Участники команды. user_id — первичный ключ: игрок состоит максимум в одной команде.
export const teamMembers = pgTable(
  "team_members",
  {
    userId: bigint("user_id", { mode: "number" })
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    role: text("role").$type<TeamRole>().notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("team_members_team_idx").on(t.teamId),
    // В команде ровно один капитан.
    uniqueIndex("team_members_one_captain_idx").on(t.teamId).where(sql`${t.role} = 'captain'`),
  ],
);

// Одноразовые приглашения. invitedUserId задан — приглашение конкретному другу;
// пусто — ссылка для любого. Живут 24 часа, срабатывают один раз.
export const teamInvites = pgTable(
  "team_invites",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    // Случайный код для ссылки t.me/...?startapp=team_<код>
    code: text("code").notNull().unique(),
    createdBy: bigint("created_by", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invitedUserId: bigint("invited_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedBy: bigint("used_by", { mode: "number" }).references(() => users.id, { onDelete: "set null" }),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [index("team_invites_invited_idx").on(t.invitedUserId)],
);

// Запланированные игры команды. Время — в UTC; каждому показываем в его часовом поясе.
export const teamGames = pgTable(
  "team_games",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    createdBy: bigint("created_by", { mode: "number" }).references(() => users.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    // Когда отправили напоминание за 15 минут (чтобы не отправить дважды).
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("team_games_starts_idx").on(t.startsAt)],
);

export type GameAnswer = "yes" | "no";

// Ответы «Буду» / «Не смогу». Один ответ от участника на игру (можно передумать).
export const teamGameResponses = pgTable(
  "team_game_responses",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => teamGames.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    answer: text("answer").$type<GameAnswer>().notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.userId] })],
);

// ===================== Этап 3: советы =====================

// Общий кеш ответов Brawl Stars API (например, справочник бравлеров).
export const apiCache = pgTable("api_cache", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
});

// pending — ждёт проверки модератором (первые 3 совета автора); published — в ленте;
// hidden — скрыт после 3 жалоб до проверки; rejected — отклонён модератором; removed — удалён.
export type TipStatus = "pending" | "published" | "hidden" | "rejected" | "removed";

// Карточка-совет. Всё, кроме текста, — выбор из списков (id из Brawl Stars API).
export const tips = pgTable(
  "tips",
  {
    id: serial("id").primaryKey(),
    authorId: bigint("author_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    brawlerId: integer("brawler_id").notNull(),
    mode: text("mode"), // пусто — для любого режима
    map: text("map"),
    gadgetId: integer("gadget_id"),
    starPowerId: integer("star_power_id"),
    gearId: integer("gear_id"),
    text: text("text").notNull(),
    status: text("status").$type<TipStatus>().notNull().default("published"),
    usefulCount: integer("useful_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tips_feed_idx").on(t.status, t.brawlerId),
    index("tips_author_idx").on(t.authorId, t.createdAt),
  ],
);

// «Полезно» — один голос от человека на совет.
export const tipVotes = pgTable(
  "tip_votes",
  {
    tipId: integer("tip_id")
      .notNull()
      .references(() => tips.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tipId, t.userId] })],
);

// Жалобы на советы: одна от человека, решение модератора — как у заявок LFG.
export const tipReports = pgTable(
  "tip_reports",
  {
    id: serial("id").primaryKey(),
    tipId: integer("tip_id")
      .notNull()
      .references(() => tips.id, { onDelete: "cascade" }),
    reporterId: bigint("reporter_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").$type<ReportReason>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolution: text("resolution").$type<ReportResolution>(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("tip_reports_once_idx").on(t.tipId, t.reporterId)],
);

export type User = typeof users.$inferSelect;
export type BattleRow = typeof battles.$inferSelect;
