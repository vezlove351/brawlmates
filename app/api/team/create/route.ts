import { lfgRoute } from "@/lib/lfg-route";
import { createTeam } from "@/lib/teams";

// Создать команду (название + эмблема из набора).
export function POST(request: Request) {
  return lfgRoute(request, (userId, body) => createTeam(userId, body.name, body.emblem));
}
