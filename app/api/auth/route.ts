import { authenticate } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { refreshUsername } from "@/lib/settings-server";

// Вход: проверяем initData и создаём пользователя при первом входе.
export async function POST(request: Request): Promise<Response> {
  const tgUser = authenticate(request);
  if (tgUser instanceof Response) return tgUser;

  // Создаём пользователя, а если он уже есть — обновляем имя (его могли поменять в Telegram).
  const [user] = await getDb()
    .insert(users)
    .values({ id: tgUser.id, firstName: tgUser.first_name })
    .onConflictDoUpdate({ target: users.id, set: { firstName: tgUser.first_name } })
    .returning();

  // Если пользователь разрешил показывать Telegram — держим @username актуальным.
  await refreshUsername(tgUser.id, tgUser.username);

  return Response.json({
    user: {
      firstName: user.firstName,
      createdAt: user.createdAt.toISOString(),
      playerTag: user.playerTag,
    },
  });
}
