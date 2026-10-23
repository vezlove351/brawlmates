import { after } from "next/server";
import { sendGameInvites } from "@/lib/game-notify";
import { lfgRoute } from "@/lib/lfg-route";
import { scheduleGame } from "@/lib/team-games";

// Капитан назначает игру — бот рассылает приглашения с кнопками.
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => {
    const gameId = await scheduleGame(userId, body.startsAt);
    after(() => sendGameInvites(gameId));
  });
}
