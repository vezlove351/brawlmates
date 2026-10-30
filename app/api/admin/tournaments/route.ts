import { authenticateAdmin } from "@/lib/admin";
import { listTournamentsForAdmin } from "@/lib/tournaments";

// Все турниры для /admin.
export async function POST(request: Request): Promise<Response> {
  const adminId = authenticateAdmin(request);
  if (adminId instanceof Response) return adminId;
  return Response.json({ tournaments: await listTournamentsForAdmin() });
}
