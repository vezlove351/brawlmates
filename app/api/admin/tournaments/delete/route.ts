import { adminRoute } from "@/lib/admin-route";
import { deleteDraft } from "@/lib/tournaments";

// Удалить черновик турнира.
export function POST(request: Request) {
  return adminRoute(request, (_adminId, body) => deleteDraft(Number(body.id)));
}
