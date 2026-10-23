import { lfgRoute } from "@/lib/lfg-route";
import { getSettings } from "@/lib/settings-server";

// Настройки приватности и список скрытых игроков.
export function POST(request: Request) {
  return lfgRoute(request, (userId) => getSettings(userId));
}
