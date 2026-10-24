import type { ReportReason } from "@/lib/db/schema";
import { LfgError } from "@/lib/lfg-server";
import { lfgRoute } from "@/lib/lfg-route";
import { reportTip } from "@/lib/tips-moderation";

const REASONS: ReportReason[] = ["rude", "spam", "scam", "other"];

// «Пожаловаться» на совет.
export function POST(request: Request) {
  return lfgRoute(request, (userId, body) => {
    const reason = REASONS.find((r) => r === body.reason);
    if (!reason) throw new LfgError("Выбери причину жалобы", 400);
    return reportTip(userId, Number(body.tipId), reason);
  });
}
