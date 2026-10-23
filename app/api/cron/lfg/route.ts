import { and, eq, lt } from "drizzle-orm";
import { removePostsFromChannel } from "@/lib/channel";
import { isFromVercelCron } from "@/lib/cron";
import { getDb } from "@/lib/db";
import { lfgPosts, tagLinkRequests } from "@/lib/db/schema";

// Каждые 15 минут (см. vercel.json): уборка LFG.
export async function GET(request: Request): Promise<Response> {
  if (!isFromVercelCron(request)) return new Response("Unauthorized", { status: 401 });

  const db = getDb();
  const now = new Date();

  // Заявки старше 2 часов скрываем из ленты.
  const expired = await db
    .update(lfgPosts)
    .set({ status: "expired" })
    .where(and(eq(lfgPosts.status, "active"), lt(lfgPosts.expiresAt, now)))
    .returning({ id: lfgPosts.id });
  await removePostsFromChannel(expired.map((p) => p.id));

  // Заодно удаляем просроченные запросы на привязку тега.
  const staleLinks = await db
    .delete(tagLinkRequests)
    .where(lt(tagLinkRequests.expiresAt, now))
    .returning({ userId: tagLinkRequests.userId });

  const summary = { expiredPosts: expired.length, staleLinkRequests: staleLinks.length };
  console.log("Крон LFG:", summary);
  return Response.json(summary);
}
