import { timingSafeEqual } from "node:crypto";
import { isNotNull } from "drizzle-orm";
import { syncPlayer } from "@/lib/battles";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

// Крону даём до 5 минут: игроков может быть много.
export const maxDuration = 300;

// Vercel присылает "Authorization: Bearer <CRON_SECRET>" — так мы знаем, что это наш крон.
function isFromVercelCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// Каждые 30 минут (см. vercel.json): сохраняем новые бои всех привязанных игроков.
export async function GET(request: Request): Promise<Response> {
  if (!isFromVercelCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rows = await getDb()
    .selectDistinct({ tag: users.playerTag })
    .from(users)
    .where(isNotNull(users.playerTag));

  let newBattles = 0;
  let failed = 0;
  // По одному игроку за раз, чтобы не упереться в лимиты API.
  for (const { tag } of rows) {
    if (!tag) continue;
    try {
      newBattles += (await syncPlayer(tag)).newBattles;
    } catch (err) {
      failed++;
      console.error(`Крон: не удалось обновить ${tag}:`, err instanceof Error ? err.message : err);
    }
  }

  const summary = { players: rows.length, newBattles, failed };
  console.log("Крон боёв:", summary);
  return Response.json(summary);
}
