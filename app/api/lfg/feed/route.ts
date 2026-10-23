import { getFeed } from "@/lib/lfg-server";
import { lfgRoute } from "@/lib/lfg-route";

// Лента активных заявок с фильтрами.
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => ({
    posts: await getFeed(userId, {
      mode: typeof body.mode === "string" ? body.mode : undefined,
      bracket: typeof body.bracket === "string" ? body.bracket : undefined,
      language: typeof body.language === "string" ? body.language : undefined,
    }),
  }));
}
