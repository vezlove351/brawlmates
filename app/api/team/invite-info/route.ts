import { lfgRoute } from "@/lib/lfg-route";
import { getInviteInfo } from "@/lib/teams";

// Что за команда в приглашении — для карточки «Вступить».
export function POST(request: Request) {
  return lfgRoute(request, (userId, body) => getInviteInfo(userId, String(body.code ?? "")));
}
