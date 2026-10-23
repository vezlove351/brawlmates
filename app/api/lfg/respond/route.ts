import { after } from "next/server";
import { respondToPost } from "@/lib/lfg-server";
import { lfgRoute, postIdFrom } from "@/lib/lfg-route";
import { notifyAuthorAboutResponse } from "@/lib/notify";

// «Я в деле»: записываем отклик и (уже после ответа) пишем автору через бота.
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => {
    const { post, responderTag } = await respondToPost(userId, postIdFrom(body));
    after(() =>
      notifyAuthorAboutResponse({
        authorId: post.authorId,
        postMode: post.mode,
        responderId: userId,
        responderTag,
      }).catch((err: unknown) =>
        // Например, автор заблокировал бота — отклик всё равно сохранён.
        console.error("Не удалось уведомить автора заявки:", err instanceof Error ? err.message : err),
      ),
    );
  });
}
