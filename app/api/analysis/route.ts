import { getAnalysis } from "@/lib/analysis";
import { lfgRoute } from "@/lib/lfg-route";

// «Мой разбор»: аналитика по своим сохранённым боям.
export function POST(request: Request) {
  return lfgRoute(request, (userId) => getAnalysis(userId));
}
