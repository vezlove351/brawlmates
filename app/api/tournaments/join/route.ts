import { lfgRoute } from "@/lib/lfg-route";
import { joinTournament } from "@/lib/tournament-play";

// «Участвовать» — условие и лимит проверяются на сервере.
export function POST(request: Request) {
  return lfgRoute(request, (userId, body) => joinTournament(userId, Number(body.id)));
}
