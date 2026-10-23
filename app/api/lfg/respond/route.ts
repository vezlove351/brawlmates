import { respondToPost } from "@/lib/lfg-server";
import { lfgRoute, postIdFrom } from "@/lib/lfg-route";

// «Я в деле».
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => {
    await respondToPost(userId, postIdFrom(body));
  });
}
