import { lfgRoute } from "@/lib/lfg-route";
import { getTipsCatalog } from "@/lib/tips";

// Списки для формы и фильтров: бравлеры с гаджетами/звёздными силами/снаряжением, режимы, карты.
export function POST(request: Request) {
  return lfgRoute(request, (userId) => getTipsCatalog(userId));
}
