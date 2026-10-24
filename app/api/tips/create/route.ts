import { lfgRoute } from "@/lib/lfg-route";
import { createTip } from "@/lib/tips";

// Новый совет. Пока публикуется сразу (премодерация — следующая задача).
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
      async () => "published",
    ),
  }));
}
