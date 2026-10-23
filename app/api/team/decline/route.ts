import { lfgRoute } from "@/lib/lfg-route";
import { declineInvite } from "@/lib/teams";

// «Не сейчас» на приглашение другу.
export function POST(request: Request) {
  return lfgRoute(request, (userId, body) => declineInvite(userId, String(body.code ?? "")));
}
