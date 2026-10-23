import { after } from "next/server";
import { targetFrom } from "@/lib/friends-route";
import { lfgRoute } from "@/lib/lfg-route";
import { notifyTeamInvite } from "@/lib/notify";
import { inviteFriend } from "@/lib/teams";

// Пригласить друга в команду — бот пришлёт ему приглашение с кнопкой.
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => {
    const friendId = await targetFrom(body);
    const invite = await inviteFriend(userId, friendId);
    after(() =>
      notifyTeamInvite(friendId, userId, invite).catch((err: unknown) =>
        console.error("Команда: не удалось отправить приглашение:", err instanceof Error ? err.message : err),
      ),
    );
  });
}
