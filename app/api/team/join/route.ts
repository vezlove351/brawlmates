import { lfgRoute } from "@/lib/lfg-route";
import { joinByInvite } from "@/lib/teams";

// Вступить в команду по приглашению.
export function POST(request: Request) {
  return lfgRoute(request, (userId, body) => joinByInvite(userId, String(body.code ?? "")));
}
