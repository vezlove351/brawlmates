import { closePost } from "@/lib/lfg-server";
import { lfgRoute, postIdFrom } from "@/lib/lfg-route";

// Автор закрывает свою заявку.
export function POST(request: Request) {
  return lfgRoute(request, (userId, body) => closePost(userId, postIdFrom(body)));
}
