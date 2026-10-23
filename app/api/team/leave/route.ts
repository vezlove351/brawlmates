import { lfgRoute } from "@/lib/lfg-route";
import { leaveTeam } from "@/lib/teams";

// Выйти из команды.
export function POST(request: Request) {
  return lfgRoute(request, (userId) => leaveTeam(userId));
}
