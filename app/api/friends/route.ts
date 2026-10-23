import { getFriendsScreen } from "@/lib/friends-server";
import { lfgRoute } from "@/lib/lfg-route";

// Экран «Друзья»: входящие заявки и друзья.
export function POST(request: Request) {
  return lfgRoute(request, (userId) => getFriendsScreen(userId));
}
