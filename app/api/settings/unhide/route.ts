import { normalizeTag } from "@/lib/brawlstars";
import { lfgRoute } from "@/lib/lfg-route";
import { unhidePlayer } from "@/lib/settings-server";

// «Показать снова» скрытого игрока.
export function POST(request: Request) {
  return lfgRoute(request, (userId, body) =>
    unhidePlayer(userId, normalizeTag(typeof body.tag === "string" ? body.tag : "")),
  );
}
