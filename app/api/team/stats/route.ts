import { lfgRoute } from "@/lib/lfg-route";
import { getTeamStats } from "@/lib/team-stats";

// Статистика команды по совместным боям.
export function POST(request: Request) {
  return lfgRoute(request, (userId) => getTeamStats(userId));
}
