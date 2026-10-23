import { hideAuthor } from "@/lib/lfg-server";
import { lfgRoute, postIdFrom } from "@/lib/lfg-route";

// «Скрыть игрока» — больше не показывать его заявки.
export function POST(request: Request) {
  return lfgRoute(request, (userId, body) => hideAuthor(userId, postIdFrom(body)));
}
