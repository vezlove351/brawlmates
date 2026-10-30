import { isFromVercelCron } from "@/lib/cron";
import { sendGameReminder } from "@/lib/game-notify";
import { claimGamesToRemind } from "@/lib/team-games";
import { sendTournamentReminders } from "@/lib/tournament-play";

// Каждую минуту (см. vercel.json): напоминания за 15 минут до игры команды
// и за 1 час / 10 минут до турнира.
export async function GET(request: Request): Promise<Response> {
  if (!isFromVercelCron(request)) return new Response("Unauthorized", { status: 401 });

  const gameIds = await claimGamesToRemind();
  for (const id of gameIds) await sendGameReminder(id);

  const tournamentReminders = await sendTournamentReminders();

  if (gameIds.length + tournamentReminders > 0) {
    console.log("Крон напоминаний: игры —", gameIds.length, "| турниры —", tournamentReminders);
  }
  return Response.json({ reminded: gameIds.length, tournamentReminders });
}
