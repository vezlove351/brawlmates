import { lfgRoute } from "@/lib/lfg-route";
import { leaveTournament } from "@/lib/tournament-play";

// «Отменить участие» — до старта.
export function POST(request: Request) {
  return lfgRoute(request, (userId, body) => leaveTournament(userId, Number(body.id)));
}
