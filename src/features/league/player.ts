import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import {
  getCategories,
  getStandings,
  getTeams,
  getTournaments,
  type Category,
  type Team,
  type Tournament,
} from "./data";

/**
 * Ficha de un jugador: la figurita del diseño, con sus números del torneo.
 *
 * Todo lo que sale de aquí es público por definición (nombre + inicial, número,
 * equipo, estadísticas). La foto solo existe si la familia dio consentimiento:
 * `public_players` devuelve `photo_path` nulo cuando no lo hay, y la política
 * del bucket tampoco la dejaría firmar. Aun así la página pide sesión: una
 * ficha de un menor no debe quedar suelta en un buscador.
 */

export type PlayerStats = {
  goals: number;
  assists: number;
  saves: number;
  fairPlay: number;
  mvps: number;
  points: number;
  matches: number;
};

export type PlayerBadge = {
  key: string;
  short: string;
  label: string;
  detail: string;
  earned: boolean;
};

export type PlayerProfile = {
  id: string;
  name: string;
  photoUrl: string | null;
  jerseyNumber: number;
  position: string | null;
  team: Team;
  category: Category;
  tournament: Tournament;
  /** Los demás torneos que jugó, para cambiar de ficha. */
  otherTournaments: Tournament[];
  stats: PlayerStats;
  badges: PlayerBadge[];
};

const PHOTO_URL_SECONDS = 3600;

/**
 * Ficha del jugador en un torneo. Sin `tournamentSlug` toma el que se está
 * jugando y, si no juega ninguno, el más reciente.
 */
export async function getPlayerProfile(
  playerId: string,
  tournamentSlug?: string,
): Promise<PlayerProfile | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("matches", "teams", `player-${playerId}`);

  const supabase = createPublicClient();

  const [{ data: entries }, tournaments, categories] = await Promise.all([
    supabase
      .from("roster_entries")
      .select("tournament_id, team_id, jersey_number, position")
      .eq("player_id", playerId),
    getTournaments(),
    getCategories(),
  ]);
  if (!entries?.length) return null;

  // getTournaments() ya viene ordenada: primero los que se juegan
  const byId = new Map(tournaments.map((t) => [t.id, t]));
  const played = entries.flatMap((e) => {
    const tournament = byId.get(e.tournament_id);
    return tournament ? [{ entry: e, tournament }] : [];
  });
  if (!played.length) return null;

  const chosen = played.find((p) => p.tournament.slug === tournamentSlug) ?? played[0];
  const { entry, tournament } = chosen;

  const teams = await getTeams(tournament.id);
  const team = teams.find((t) => t.id === entry.team_id);
  const category = team ? categories.find((c) => c.id === team.categoryId) : undefined;
  if (!team || !category) return null;

  const [{ data: player }, { data: stats }, { count: matches }, { data: goals }] = await Promise.all([
    supabase.from("public_players").select("display_name, photo_path").eq("id", playerId).maybeSingle(),
    supabase
      .from("player_season_stats")
      .select("*")
      .eq("tournament_id", tournament.id)
      .eq("player_id", playerId)
      .maybeSingle(),
    supabase
      .from("match_attendance")
      .select("match_id, match:matches!inner(tournament_id)", { count: "exact", head: true })
      .eq("player_id", playerId)
      .eq("match.tournament_id", tournament.id),
    supabase
      .from("scoring_events")
      .select("match_id")
      .eq("player_id", playerId)
      .eq("tournament_id", tournament.id)
      .eq("code", "goal"),
  ]);

  const line: PlayerStats = {
    goals: stats?.goals ?? 0,
    assists: stats?.assists ?? 0,
    saves: stats?.saves ?? 0,
    fairPlay: stats?.fair_play ?? 0,
    mvps: stats?.mvps ?? 0,
    points: stats?.points ?? 0,
    matches: matches ?? 0,
  };

  return {
    id: playerId,
    name: player?.display_name ?? "Jugador",
    photoUrl: await signPhoto(supabase, player?.photo_path ?? null),
    jerseyNumber: entry.jersey_number,
    position: entry.position,
    team,
    category,
    tournament,
    otherTournaments: played.filter((p) => p.tournament.id !== tournament.id).map((p) => p.tournament),
    stats: line,
    badges: await getBadges({ stats: line, goals: goals ?? [], tournament, teamId: team.id, categoryId: category.id }),
  };
}

/** La foto solo se firma si existe; sin consentimiento, `photo_path` llega nulo. */
async function signPhoto(
  supabase: ReturnType<typeof createPublicClient>,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("player-photos").createSignedUrl(path, PHOTO_URL_SECONDS);
  return data?.signedUrl ?? null;
}

/**
 * Insignias. Todas salen de lo que de verdad pasó en la cancha: no hay ninguna
 * decorativa, porque una insignia que no se ganó no celebra nada.
 */
async function getBadges({
  stats,
  goals,
  tournament,
  teamId,
  categoryId,
}: {
  stats: PlayerStats;
  goals: { match_id: string | null }[];
  tournament: Tournament;
  teamId: string;
  categoryId: string;
}): Promise<PlayerBadge[]> {
  // ¿Marcó tres o más en un mismo partido?
  const perMatch = new Map<string, number>();
  for (const g of goals) {
    if (g.match_id) perMatch.set(g.match_id, (perMatch.get(g.match_id) ?? 0) + 1);
  }
  const hatTrick = [...perMatch.values()].some((n) => n >= 3);

  // Campeón: el torneo terminó y su equipo quedó primero
  let champion = false;
  if (tournament.status === "finalizado") {
    const standings = await getStandings(tournament.id, categoryId);
    champion = standings.some((row) => row.position === 1 && row.team.id === teamId);
  }

  return [
    {
      key: "primer-gol",
      short: "1º",
      label: "Primer gol",
      detail: "Marcó en el torneo",
      earned: stats.goals >= 1,
    },
    {
      key: "triplete",
      short: "3x",
      label: "Triplete",
      detail: "Tres goles en un partido",
      earned: hatTrick,
    },
    {
      key: "fair-play",
      short: "FP",
      label: "Fair play",
      detail: "Cinco reconocimientos de fair play",
      earned: stats.fairPlay >= 5,
    },
    {
      key: "mvp",
      short: "MVP",
      label: "Jugador del partido",
      detail: "Elegido jugador del partido",
      earned: stats.mvps >= 1,
    },
    {
      key: "campeon",
      short: "★",
      label: "Campeón",
      detail: "Su equipo terminó primero",
      earned: champion,
    },
  ];
}
