import { after } from "next/server";
import { adminRoute } from "@/lib/admin-route";
import { announceTournament, openRegistration } from "@/lib/tournaments";

// Открыть регистрацию и опубликовать анонс в канале.
export function POST(request: Request) {
  return adminRoute(request, async (_adminId, body) => {
    const t = await openRegistration(Number(body.id));
    after(() =>
      announceTournament(t).catch((err: unknown) =>
        console.error("Турнир: не удалось опубликовать анонс:", err instanceof Error ? err.message : err),
      ),
    );
  });
}
