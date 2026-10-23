import { normalizeTag } from "./brawlstars";
import { userIdByTag } from "./friends-server";
import { LfgError } from "./lfg-server";

// Пользователь Brawlmates по тегу из тела запроса.
export async function targetFrom(body: Record<string, unknown>): Promise<number> {
  const tag = normalizeTag(typeof body.tag === "string" ? body.tag : "");
  const id = await userIdByTag(tag);
  if (!id) throw new LfgError("Этот игрок ещё не пользуется Brawlmates", 404);
  return id;
}
