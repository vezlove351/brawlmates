import { isRankingCountry } from "@/lib/countries";
import { LfgError } from "@/lib/lfg-server";
import { lfgRoute } from "@/lib/lfg-route";
import { getUserTag } from "@/lib/user";
import { brawlmatesTags, getBrawlmatesRanking, getRanking } from "@/lib/rankings";

// Рейтинги: scope = "global" | "country" (+ country) | "brawlmates".
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => {
    const myTag = await getUserTag(userId);

    if (body.scope === "brawlmates") {
      return { scope: "brawlmates", ...(await getBrawlmatesRanking(userId)), myTag };
    }

    let key = "global";
    if (body.scope === "country") {
      const country = typeof body.country === "string" ? body.country.toUpperCase() : "";
      if (!isRankingCountry(country)) throw new LfgError("Неизвестная страна", 400);
      key = country;
    }

    const { entries, fetchedAt } = await getRanking(key);
    // Отмечаем игроков, которые есть в Brawlmates, — их профиль можно открыть.
    const ours = await brawlmatesTags(entries.map((e) => e.tag));
    return {
      scope: body.scope === "country" ? "country" : "global",
      entries: entries.map((e) => ({ ...e, inBrawlmates: ours.has(e.tag) })),
      me: entries.find((e) => e.tag === myTag) ?? null,
      myTag,
      updatedMinutesAgo: Math.floor((Date.now() - fetchedAt.getTime()) / 60_000),
    };
  });
}
