import { lfgRoute } from "@/lib/lfg-route";
import { getTournamentPage } from "@/lib/tournament-play";

// Страница турнира.
export function POST(request: Request) {
  return lfgRoute(request, (userId, body) => getTournamentPage(userId, Number(body.id)));
}
