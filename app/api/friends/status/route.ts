import { getRelation } from "@/lib/friends-server";
import { targetFrom } from "@/lib/friends-route";
import { lfgRoute } from "@/lib/lfg-route";

// Отношения с игроком — для кнопки на его профиле.
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => ({
    relation: await getRelation(userId, await targetFrom(body)),
  }));
}
