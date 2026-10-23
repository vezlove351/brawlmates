import { lfgRoute } from "@/lib/lfg-route";
import { deleteAccount } from "@/lib/settings-server";

// Удалить аккаунт и все данные одной кнопкой.
export function POST(request: Request) {
  return lfgRoute(request, (userId) => deleteAccount(userId));
}
