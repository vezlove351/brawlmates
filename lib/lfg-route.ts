import { authenticate } from "./auth";
import { BrawlStarsError } from "./brawlstars";
import { LfgError } from "./lfg-server";

// Общая обёртка для маршрутов LFG: проверка входа, разбор тела, понятные ошибки.
export async function lfgRoute(
  request: Request,
  handler: (userId: number, body: Record<string, unknown>) => Promise<unknown>,
): Promise<Response> {
  const tgUser = authenticate(request);
  if (tgUser instanceof Response) return tgUser;

  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  try {
    return Response.json((await handler(tgUser.id, body)) ?? { ok: true });
  } catch (err) {
    if (err instanceof LfgError || err instanceof BrawlStarsError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

// id заявки из тела запроса.
export function postIdFrom(body: Record<string, unknown>): number {
  const id = Number(body.postId);
  if (!Number.isInteger(id) || id <= 0) throw new LfgError("Неизвестная заявка", 400);
  return id;
}
