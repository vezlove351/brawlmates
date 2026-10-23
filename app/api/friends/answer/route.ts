import { after } from "next/server";
import { answerFriendRequest } from "@/lib/friends-server";
import { targetFrom } from "@/lib/friends-route";
import { lfgRoute } from "@/lib/lfg-route";
import { notifyFriend } from "@/lib/notify";

// «Принять» / «Отклонить» входящую заявку. Об отказе отправитель не узнаёт.
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => {
    const requesterId = await targetFrom(body);
    const accept = body.accept === true;
    await answerFriendRequest(userId, requesterId, accept);
    if (accept) {
      after(() =>
        notifyFriend(requesterId, userId, "accepted").catch((err: unknown) =>
          console.error("Друзья: не удалось уведомить:", err instanceof Error ? err.message : err),
        ),
      );
    }
  });
}
