import Link from "next/link";
import { connection } from "next/server";
import { Medal } from "lucide-react";
import { getFollowState, getMyVoteState } from "@/features/family/data";
import { getMatchRosters, type Team } from "@/features/league/data";
import { FollowButton, MvpVote } from "./components";

/**
 * Piezas de las páginas públicas que dependen de la sesión del usuario.
 * Leen cookies: siempre dentro de <Suspense>.
 */

export async function FollowTeamSection({ teamId }: { teamId: string }) {
  const following = await getFollowState(teamId);
  if (following === null) {
    return (
      <Link href={`/ingresar?next=/equipos/${teamId}`} className="text-sm font-medium text-brand-blue">
        Ingresa para seguir a este equipo
      </Link>
    );
  }
  return <FollowButton teamId={teamId} following={following} />;
}

export async function MvpVoteSection({
  matchId,
  home,
  away,
  closesAt,
}: {
  matchId: string;
  home: Team;
  away: Team;
  closesAt: string;
}) {
  if (await votingClosed(closesAt)) return null;

  const [vote, rosters] = await Promise.all([getMyVoteState(matchId, [home.id, away.id]), getMatchRosters(home.id, away.id)]);

  if (vote.state === "login") {
    return (
      <Notice>
        Las familias de los dos equipos votan al jugador del partido.{" "}
        <Link href={`/ingresar?next=/partidos/${matchId}`} className="font-semibold text-brand-blue">
          Ingresa para votar
        </Link>
        .
      </Notice>
    );
  }
  if (vote.state === "not-eligible") {
    return <Notice>Votan solo las familias con hijos en estos dos equipos.</Notice>;
  }
  if (vote.state === "voted") {
    const name = rosters.find((r) => r.playerId === vote.playerId)?.name ?? "un jugador";
    return (
      <Notice>
        Tu familia ya votó por <strong>{name}</strong>. ¡Gracias! El resultado se publica al cerrar la votación.
      </Notice>
    );
  }

  const excluded = new Set(vote.excludedPlayerIds);
  const teamName = (teamId: string) => (teamId === home.id ? home.name : away.name);
  const players = rosters
    .filter((r) => !excluded.has(r.playerId))
    .map((r) => ({ playerId: r.playerId, name: r.name, number: r.number, teamName: teamName(r.teamId) }));

  return <MvpVote matchId={matchId} players={players} closesAt={closesAt} />;
}

/** Se evalúa por petición (connection) para no prerenderizar una hora vieja. */
async function votingClosed(closesAt: string) {
  await connection();
  return Date.now() > new Date(closesAt).getTime();
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm">
      <Medal className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
