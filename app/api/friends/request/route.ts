import { after } from "next/server";
import { sendFriendRequest } from "@/lib/friends-server";
import { targetFrom } from "@/lib/friends-route";
import { lfgRoute } from "@/lib/lfg-route";
import { notifyFriend } from "@/lib/notify";

// «Добавить в друзья».
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => {
    const { relation, notify } = await sendFriendRequest(userId, await targetFrom(body));
    if (notify) {
      after(() =>
        notifyFriend(notify.userId, userId, notify.kind).catch((err: unknown) =>
          console.error("Друзья: не удалось уведомить:", err instanceof Error ? err.message : err),
        ),
      );
    }
    return { relation };
  });
}
