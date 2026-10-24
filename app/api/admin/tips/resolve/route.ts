import { after } from "next/server";
import { authenticateAdmin } from "@/lib/admin";
import { LfgError } from "@/lib/lfg-server";
import { notifyTipDecision } from "@/lib/notify";
import { resolveTip, type TipAdminAction } from "@/lib/tips-moderation";

const ACTIONS: TipAdminAction[] = ["approve", "reject", "keep", "remove", "ban"];

// Решение модератора по совету.
export async function POST(request: Request): Promise<Response> {
  const adminId = authenticateAdmin(request);
  if (adminId instanceof Response) return adminId;

  const body = (await request.json().catch(() => null)) as { tipId?: unknown; action?: unknown } | null;
  const tipId = Number(body?.tipId);
  const action = ACTIONS.find((a) => a === body?.action);
  if (!Number.isInteger(tipId) || !action) return Response.json({ error: "Неверный запрос" }, { status: 400 });

  try {
    const notice = await resolveTip(tipId, action);
    console.log(`Модерация советов: ${tipId} — ${action}`);
    if (notice) {
      after(() =>
        notifyTipDecision(notice.authorId, notice.approved).catch((err: unknown) =>
          console.error("Советы: не удалось уведомить автора:", err instanceof Error ? err.message : err),
        ),
      );
    }
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof LfgError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
