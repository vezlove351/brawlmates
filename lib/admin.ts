import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { authenticate } from "./auth";
import { getDb } from "./db";
import { lfgPosts, lfgReports, users, type ReportResolution } from "./db/schema";

// Telegram ID модераторов — из переменной ADMIN_IDS (через запятую).
export function isAdmin(userId: number): boolean {
  const ids = (process.env.ADMIN_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(String(userId));
}

// Проверка входа + прав модератора. Возвращает id или готовый ответ 401/403.
export function authenticateAdmin(request: Request): number | Response {
  const tgUser = authenticate(request);
  if (tgUser instanceof Response) return tgUser;
  if (!isAdmin(tgUser.id)) return Response.json({ error: "Нет доступа" }, { status: 403 });
  return tgUser.id;
}

// Заявки с непроверенными жалобами — для страницы /admin.
export async function getPendingReports() {
  const db = getDb();
  const rows = await db
    .select({
      post: lfgPosts,
      authorBanned: users.bannedAt,
      reports: sql<number>`count(*)::int`,
      reasons: sql<string[]>`array_agg(${lfgReports.reason})`,
      lastReportAt: sql<string>`max(${lfgReports.createdAt})`,
    })
    .from(lfgReports)
    .innerJoin(lfgPosts, eq(lfgPosts.id, lfgReports.postId))
    .innerJoin(users, eq(users.id, lfgPosts.authorId))
    .where(isNull(lfgReports.resolution))
    .groupBy(lfgPosts.id, users.bannedAt)
    .orderBy(desc(sql`count(*)`), desc(sql`max(${lfgReports.createdAt})`));

  return rows.map((r) => ({
    postId: r.post.id,
    playerTag: r.post.playerTag,
    playerName: r.post.playerName,
    mode: r.post.mode,
    comment: r.post.comment,
    status: r.post.status,
    createdAt: r.post.createdAt.toISOString(),
    authorBanned: r.authorBanned !== null,
    reports: r.reports,
    reasons: r.reasons,
  }));
}

export type AdminAction = "keep" | "remove" | "ban";

// Решение модератора по заявке.
export async function resolveReports(postId: number, action: AdminAction) {
  const db = getDb();
  const [post] = await db.select().from(lfgPosts).where(eq(lfgPosts.id, postId));
  if (!post) return;

  const resolution: ReportResolution = action === "keep" ? "kept" : action === "remove" ? "removed" : "banned";
  const markReports = db
    .update(lfgReports)
    .set({ resolution, resolvedAt: new Date() })
    .where(and(eq(lfgReports.postId, postId), isNull(lfgReports.resolution)));

  if (action === "keep") {
    // Заявка в порядке: если её скрыли жалобы и она ещё не истекла — возвращаем в ленту.
    const restore = post.status === "hidden" && post.expiresAt > new Date();
    await db.batch([
      markReports,
      db
        .update(lfgPosts)
        .set({ status: restore ? "active" : post.status === "hidden" ? "expired" : post.status })
        .where(eq(lfgPosts.id, postId)),
    ]);
    return;
  }

  if (action === "remove") {
    await db.batch([markReports, db.update(lfgPosts).set({ status: "removed" }).where(eq(lfgPosts.id, postId))]);
    return;
  }

  // Блокировка: автор больше не может создавать заявки и откликаться,
  // все его активные и скрытые заявки снимаются.
  await db.batch([
    markReports,
    db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, post.authorId)),
    db
      .update(lfgPosts)
      .set({ status: "removed" })
      .where(and(eq(lfgPosts.authorId, post.authorId), inArray(lfgPosts.status, ["active", "hidden"]))),
    db.update(lfgPosts).set({ status: "removed" }).where(eq(lfgPosts.id, postId)),
  ]);
}
