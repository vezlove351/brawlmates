import { authenticate } from "@/lib/auth";
import { BrawlStarsError } from "@/lib/brawlstars";
import type { LfgPostInput } from "@/lib/lfg";
import { createPost, LfgError, toPublicPost } from "@/lib/lfg-server";

// Создание заявки «ищу тиммейта». Все проверки — в createPost.
export async function POST(request: Request): Promise<Response> {
  const tgUser = authenticate(request);
  if (tgUser instanceof Response) return tgUser;

  const body = (await request.json().catch(() => null)) as Partial<LfgPostInput> | null;
  if (!body) return Response.json({ error: "Пустая заявка" }, { status: 400 });

  try {
    const post = await createPost(tgUser.id, {
      mode: String(body.mode ?? ""),
      brawlerIds: Array.isArray(body.brawlerIds) ? body.brawlerIds.filter(Number.isInteger) : [],
      bracket: String(body.bracket ?? ""),
      language: String(body.language ?? ""),
      playersNeeded: Number(body.playersNeeded),
      comment: typeof body.comment === "string" ? body.comment : "",
    });
    return Response.json({ post: toPublicPost(post) });
  } catch (err) {
    if (err instanceof LfgError || err instanceof BrawlStarsError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
