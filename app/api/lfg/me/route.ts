import { authenticate } from "@/lib/auth";
import { LFG_DAILY_POST_LIMIT } from "@/lib/lfg";
import { countPostsLast24h, getActivePost, toPublicPost } from "@/lib/lfg-server";

// Моя активная заявка и сколько ещё заявок можно создать сегодня.
export async function POST(request: Request): Promise<Response> {
  const tgUser = authenticate(request);
  if (tgUser instanceof Response) return tgUser;

  const [post, createdToday] = await Promise.all([
    getActivePost(tgUser.id),
    countPostsLast24h(tgUser.id),
  ]);

  return Response.json({
    activePost: post ? toPublicPost(post) : null,
    postsLeftToday: Math.max(0, LFG_DAILY_POST_LIMIT - createdToday),
  });
}
