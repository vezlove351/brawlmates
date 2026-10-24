import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "./db";
import { playerProfiles, tipReports, tips, users, type ReportReason } from "./db/schema";
import { LfgError } from "./lfg-server";
import { getBrawlerCatalog, toTipCard } from "./tips";

// Сколько первых советов автора проверяет модератор.
export const PREMODERATED_TIPS = 3;
// Сколько разных людей должны пожаловаться, чтобы совет скрылся до проверки.
export const TIP_REPORTS_TO_HIDE = 3;

// Статус нового совета: первые 3 — на проверку, дальше — сразу в ленту.
export async function decideTipStatus(authorId: number): Promise<"pending" | "published"> {
  // «Одобренные» — те, что модератор пропустил: сейчас в ленте или скрыты жалобами.
  const [approved] = await getDb()
    .select({ n: count() })
    .from(tips)
    .where(and(eq(tips.authorId, authorId), inArray(tips.status, ["published", "hidden"])));
  return (approved?.n ?? 0) >= PREMODERATED_TIPS ? "published" : "pending";
}

// Жалоба на совет. После 3 жалоб от разных людей совет скрывается до проверки.
export async function reportTip(userId: number, tipId: number, reason: ReportReason) {
  const db = getDb();
  const [tip] = await db.select().from(tips).where(eq(tips.id, tipId));
  if (!tip || tip.status !== "published") throw new LfgError("Совет недоступен", 404);
  if (tip.authorId === userId) throw new LfgError("Это твой совет", 400);
  try {
    await db.insert(tipReports).values({ tipId, reporterId: userId, reason });
  } catch {
    throw new LfgError("Ты уже пожаловался на этот совет", 409);
  }
  const [reports] = await db
    .select({ n: count() })
    .from(tipReports)
    .where(and(eq(tipReports.tipId, tipId), isNull(tipReports.resolution)));
  if ((reports?.n ?? 0) >= TIP_REPORTS_TO_HIDE) {
    await db.update(tips).set({ status: "hidden" }).where(and(eq(tips.id, tipId), eq(tips.status, "published")));
  }
}

// --- Для /admin ---

export async function getTipsModeration(adminId: number) {
  const db = getDb();
  const catalog = await getBrawlerCatalog();

  const pendingRows = await db
    .select({ tip: tips, author: playerProfiles.data })
    .from(tips)
    .innerJoin(users, eq(users.id, tips.authorId))
    .leftJoin(playerProfiles, eq(playerProfiles.tag, users.playerTag))
    .where(eq(tips.status, "pending"))
    .orderBy(tips.createdAt)
    .limit(50);

  const reportedRows = await db
    .select({
      tip: tips,
      author: playerProfiles.data,
      reports: sql<number>`count(*)::int`,
      reasons: sql<string[]>`array_agg(${tipReports.reason})`,
    })
    .from(tipReports)
    .innerJoin(tips, eq(tips.id, tipReports.tipId))
    .innerJoin(users, eq(users.id, tips.authorId))
    .leftJoin(playerProfiles, eq(playerProfiles.tag, users.playerTag))
    .where(isNull(tipReports.resolution))
    .groupBy(tips.id, playerProfiles.data)
    .orderBy(desc(sql`count(*)`))
    .limit(50);

  return {
    pending: pendingRows.map((r) => toTipCard(r.tip, r.author, catalog, adminId, false)),
    reported: reportedRows.map((r) => ({
      ...toTipCard(r.tip, r.author, catalog, adminId, false),
      reports: r.reports,
      reasons: r.reasons,
    })),
  };
}

export type TipAdminAction = "approve" | "reject" | "keep" | "remove" | "ban";

// Решение модератора. Возвращает, кому и что сообщить (или null).
export async function resolveTip(tipId: number, action: TipAdminAction) {
  const db = getDb();
  const [tip] = await db.select().from(tips).where(eq(tips.id, tipId));
  if (!tip) throw new LfgError("Совет не найден", 404);
  const now = new Date();
  const closeReports = (resolution: "kept" | "removed" | "banned") =>
    db
      .update(tipReports)
      .set({ resolution, resolvedAt: now })
      .where(and(eq(tipReports.tipId, tipId), isNull(tipReports.resolution)));

  switch (action) {
    case "approve":
      if (tip.status !== "pending") throw new LfgError("Совет уже проверен", 409);
      await db.update(tips).set({ status: "published" }).where(eq(tips.id, tipId));
      return { authorId: tip.authorId, approved: true };
    case "reject":
      if (tip.status !== "pending") throw new LfgError("Совет уже проверен", 409);
      await db.update(tips).set({ status: "rejected" }).where(eq(tips.id, tipId));
      return { authorId: tip.authorId, approved: false };
    case "keep":
      // Совет в порядке — снова в ленте.
      await db.batch([
        closeReports("kept"),
        db.update(tips).set({ status: "published" }).where(and(eq(tips.id, tipId), eq(tips.status, "hidden"))),
      ]);
      return null;
    case "remove":
      await db.batch([closeReports("removed"), db.update(tips).set({ status: "removed" }).where(eq(tips.id, tipId))]);
      return null;
    case "ban":
      // Блокировка: автор больше ничего не публикует, все его советы снимаются.
      await db.batch([
        closeReports("banned"),
        db.update(users).set({ bannedAt: now }).where(eq(users.id, tip.authorId)),
        db
          .update(tips)
          .set({ status: "removed" })
          .where(and(eq(tips.authorId, tip.authorId), inArray(tips.status, ["pending", "published", "hidden"]))),
      ]);
      return null;
  }
}
