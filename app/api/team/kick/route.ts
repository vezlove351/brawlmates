import { targetFrom } from "@/lib/friends-route";
import { lfgRoute } from "@/lib/lfg-route";
import { kickMember } from "@/lib/teams";

// Капитан исключает участника.
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => kickMember(userId, await targetFrom(body)));
}
