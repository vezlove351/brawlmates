import { removeFriend } from "@/lib/friends-server";
import { targetFrom } from "@/lib/friends-route";
import { lfgRoute } from "@/lib/lfg-route";

// «Удалить из друзей» (без уведомления второму человеку).
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => removeFriend(userId, await targetFrom(body)));
}
