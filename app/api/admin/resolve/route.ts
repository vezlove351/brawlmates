import { authenticateAdmin, resolveReports, type AdminAction } from "@/lib/admin";

const ACTIONS: AdminAction[] = ["keep", "remove", "ban"];

// Решение модератора: «Оставить» / «Удалить» / «Заблокировать автора».
export async function POST(request: Request): Promise<Response> {
  const adminId = authenticateAdmin(request);
  if (adminId instanceof Response) return adminId;

  const body = (await request.json().catch(() => null)) as { postId?: unknown; action?: unknown } | null;
  const postId = Number(body?.postId);
  const action = ACTIONS.find((a) => a === body?.action);
  if (!Number.isInteger(postId) || !action) {
    return Response.json({ error: "Неверный запрос" }, { status: 400 });
  }

  await resolveReports(postId, action);
  console.log(`Модерация: заявка ${postId} — ${action}`);
  return Response.json({ ok: true });
}
