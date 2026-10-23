import { after } from "next/server";
import { sendGameCancelled } from "@/lib/game-notify";
import { lfgRoute } from "@/lib/lfg-route";
import { cancelGame } from "@/lib/team-games";

// Капитан отменяет игру — участники получают сообщение.
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => {
    const gameId = Number(body.gameId);
    await cancelGame(userId, gameId);
    after(() => sendGameCancelled(gameId));
  });
}
