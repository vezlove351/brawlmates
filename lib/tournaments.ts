import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { playerProfiles, tournamentParticipants, tournamentResults, tournamentRounds, users } from "./db/schema";

// Таблица очков турнира. Не хранится отдельно, а считается из результатов раундов —
// поэтому никогда не расходится с ними: поправили место — очки пересчитались сами.
export async function getStandings(tournamentId: number) {
  const db = getDb();
  const rows = await db
    .select({
      userId: tournamentParticipants.userId,
      playerTag: tournamentParticipants.playerTag,
      name: sql<string | null>`${playerProfiles.data}->>'name'`,
      points: sql<number>`coalesce(sum(${tournamentResults.points}) filter (where ${tournamentRounds.status} = 'confirmed'), 0)::int`,
      roundsPlayed: sql<number>`count(${tournamentResults.place}) filter (where ${tournamentRounds.status} = 'confirmed')::int`,
      bestPlace: sql<number | null>`min(${tournamentResults.place}) filter (where ${tournamentRounds.status} = 'confirmed')`,
      wins: sql<number>`count(*) filter (where ${tournamentResults.place} = 1 and ${tournamentRounds.status} = 'confirmed')::int`,
    })
    .from(tournamentParticipants)
    .innerJoin(users, eq(users.id, tournamentParticipants.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.tag, tournamentParticipants.playerTag))
    .leftJoin(tournamentRounds, eq(tournamentRounds.tournamentId, tournamentParticipants.tournamentId))
    .leftJoin(
      tournamentResults,
      and(eq(tournamentResults.roundId, tournamentRounds.id), eq(tournamentResults.userId, tournamentParticipants.userId)),
    )
    .where(eq(tournamentParticipants.tournamentId, tournamentId))
    .groupBy(tournamentParticipants.userId, tournamentParticipants.playerTag, playerProfiles.data);

  // Больше очков — выше; при равенстве — больше побед, потом лучшее место.
  rows.sort(
    (a, b) => b.points - a.points || b.wins - a.wins || (a.bestPlace ?? 99) - (b.bestPlace ?? 99),
  );
  return rows.map((r, i) => ({ ...r, name: r.name ?? r.playerTag, position: i + 1 }));
}

// Очки за место по правилам турнира (места вне списка — 0).
export function pointsFor(place: number | null, pointsByPlace: number[]): number {
  if (place === null || place < 1) return 0;
  return pointsByPlace[place - 1] ?? 0;
}
