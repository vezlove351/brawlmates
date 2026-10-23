import { authenticate } from "@/lib/auth";
import { setAcceptFriendRequests, setShowContact } from "@/lib/settings-server";

// Изменить одну настройку приватности: показ Telegram или приём заявок в друзья.
export async function POST(request: Request): Promise<Response> {
  const tgUser = authenticate(request);
  if (tgUser instanceof Response) return tgUser;

  const body = (await request.json().catch(() => null)) as {
    showTelegramContact?: unknown;
    acceptFriendRequests?: unknown;
  } | null;

  if (typeof body?.acceptFriendRequests === "boolean") {
    await setAcceptFriendRequests(tgUser.id, body.acceptFriendRequests);
    return Response.json({ acceptFriendRequests: body.acceptFriendRequests });
  }

  const show = body?.showTelegramContact === true;
  // @username берём из проверенных данных Telegram, а не из запроса.
  if (show && !tgUser.username) {
    return Response.json(
      { error: "У тебя нет @username в Telegram — показывать нечего. Его можно задать в настройках Telegram." },
      { status: 400 },
    );
  }
  await setShowContact(tgUser.id, show, tgUser.username);
  return Response.json({ showTelegramContact: show });
}
