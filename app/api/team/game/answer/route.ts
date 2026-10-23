import { LfgError } from "@/lib/lfg-server";
import { lfgRoute } from "@/lib/lfg-route";
import { answerGame } from "@/lib/team-games";

// «Буду» / «Не смогу» из приложения.
export function POST(request: Request) {
  return lfgRoute(request, async (userId, body) => {
    const answer = body.answer === "yes" ? "yes" : body.answer === "no" ? "no" : null;
    if (!answer) throw new LfgError("Неверный ответ", 400);
    await answerGame(userId, Number(body.gameId), answer);
  });
}
