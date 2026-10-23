import { isFromVercelCron } from "@/lib/cron";
import { sendGameReminder } from "@/lib/game-notify";
import { claimGamesToRemind } from "@/lib/team-games";

// Каждую минуту (см. vercel.json): напоминания за 15 минут до игры команды.
export async function GET(request: Request): Promise<Response> {
  if (!isFromVercelCron(request)) return new Response("Unauthorized", { status: 401 });

  const gameIds = await claimGamesToRemind();
  for (const id of gameIds) await sendGameReminder(id);

  if (gameIds.length > 0) console.log("Крон игр: напоминаний —", gameIds.length);
  return Response.json({ reminded: gameIds.length });
}
