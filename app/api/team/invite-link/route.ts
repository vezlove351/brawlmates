import { lfgRoute } from "@/lib/lfg-route";
import { createInviteLink } from "@/lib/teams";

// Одноразовая ссылка-приглашение (24 часа).
export function POST(request: Request) {
  return lfgRoute(request, (userId) => createInviteLink(userId));
}
