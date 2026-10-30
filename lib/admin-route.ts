import { authenticateAdmin } from "./admin";
import { LfgError } from "./lfg-server";

// Обёртка для админских маршрутов: проверка ADMIN_IDS, разбор тела, понятные ошибки.
export async function adminRoute(
  request: Request,
  handler: (adminId: number, body: Record<string, unknown>) => Promise<unknown>,
): Promise<Response> {
  const adminId = authenticateAdmin(request);
  if (adminId instanceof Response) return adminId;
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  try {
    return Response.json((await handler(adminId, body)) ?? { ok: true });
  } catch (err) {
    if (err instanceof LfgError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
