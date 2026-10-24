import { authenticateAdmin } from "@/lib/admin";
import { getTipsModeration } from "@/lib/tips-moderation";

// Очереди модерации советов: на проверку и с жалобами (только ADMIN_IDS).
export async function POST(request: Request): Promise<Response> {
  const adminId = authenticateAdmin(request);
  if (adminId instanceof Response) return adminId;
  return Response.json(await getTipsModeration(adminId));
}
