import { lfgRoute } from "@/lib/lfg-route";
import { createTip } from "@/lib/tips";
import { decideTipStatus } from "@/lib/tips-moderation";

// Новый совет. Первые 3 совета автора — на проверку модератору, дальше — сразу в ленту.
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => ({
    tip: await createTip(
      userId,
      {
        brawlerId: body.brawlerId,
        mode: body.mode,
        map: body.map,
        gadgetId: body.gadgetId,
        starPowerId: body.starPowerId,
        gearId: body.gearId,
        text: body.text,
      },
      decideTipStatus,
    ),
  }));
}
