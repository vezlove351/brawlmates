import { adminRoute } from "@/lib/admin-route";
import { createTournament } from "@/lib/tournaments";

// Создать турнир (черновиком).
export function POST(request: Request) {
  return adminRoute(request, async (adminId, body) => ({
    id: await createTournament(adminId, {
      title: body.title,
      description: body.description,
      startsAt: body.startsAt,
      map: body.map,
      rounds: body.rounds,
      pointsByPlace: body.pointsByPlace,
      maxPlayers: body.maxPlayers,
      condition: body.condition,
      minTrophies: body.minTrophies,
    }),
  }));
}
