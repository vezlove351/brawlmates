import { authenticateAdmin, getPendingReports } from "@/lib/admin";

// Список заявок с непроверенными жалобами (только для модераторов из ADMIN_IDS).
export async function POST(request: Request): Promise<Response> {
  const adminId = authenticateAdmin(request);
  if (adminId instanceof Response) return adminId;
  return Response.json({ items: await getPendingReports() });
}
