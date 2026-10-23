import { lfgRoute } from "@/lib/lfg-route";
import { getMyTeam } from "@/lib/teams";

// Экран «Моя команда».
export function POST(request: Request) {
  return lfgRoute(request, (userId) => getMyTeam(userId));
}
