import { lfgRoute } from "@/lib/lfg-route";
import { voteUseful } from "@/lib/tips";

// «Полезно» — один раз на человека.
export function POST(request: Request) {
  return lfgRoute(request, (userId, body) => voteUseful(userId, Number(body.tipId)));
}
