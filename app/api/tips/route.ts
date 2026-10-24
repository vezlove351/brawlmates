import { lfgRoute } from "@/lib/lfg-route";
import { getTipsFeed } from "@/lib/tips";

// Лента советов: фильтры по бравлеру и режиму, сортировка «полезные» / «новые».
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => ({
    tips: await getTipsFeed(userId, {
      brawlerId: Number(body.brawlerId) || undefined,
      mode: typeof body.mode === "string" && body.mode ? body.mode : undefined,
      sort: body.sort === "new" ? "new" : "useful",
    }),
  }));
}
