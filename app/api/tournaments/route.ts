import { lfgRoute } from "@/lib/lfg-route";
import { listTournaments } from "@/lib/tournament-play";

// Раздел «Турниры»: ближайшие и прошедшие.
export function POST(request: Request) {
  return lfgRoute(request, (userId) => listTournaments(userId));
}
