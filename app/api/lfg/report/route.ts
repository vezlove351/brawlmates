import type { ReportReason } from "@/lib/db/schema";
import { LfgError, reportPost } from "@/lib/lfg-server";
import { lfgRoute, postIdFrom } from "@/lib/lfg-route";

const REASONS: ReportReason[] = ["rude", "spam", "scam", "other"];

// «Пожаловаться» на заявку.
export function POST(request: Request) {
  return lfgRoute(request, (userId, body) => {
    const reason = REASONS.find((r) => r === body.reason);
    if (!reason) throw new LfgError("Выбери причину жалобы", 400);
    return reportPost(userId, postIdFrom(body), reason);
  });
}
