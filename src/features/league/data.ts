import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Enums } from "@/types/database";
import { createPublicClient, teamLogoUrl } from "@/lib/supabase/public";

/**
 * Consultas de datos PÚBLICOS de la liga, en caché (perfil "minutes": se
 * refrescan cada minuto en segundo plano). Nada de esto depende del usuario.
 * El marcador en vivo en tiempo real llega en la fase 4 con Supabase Realtime.
 */

export type RecognitionMode = Enums<"recognition_mode">;
export type MatchStatus = Enums<"match_status">;
export type TournamentStatus = Enums<"tournament_status">;

/**
 * Torneo = liga × circuito (Academias/Escolares) × tipo (Apertura/Clausura/
 * Copa de Navidad) × año. Sustituye a la antigua "temporada", que era una sola
 * para toda la plataforma. Pueden estar varios en curso a la vez.
 * La temporada es ahora el año (`year`).
 */
export type Tournament = {
  id: string;
  leagueId: string;
  leagueName: string;
  slug: string; // "academias-clausura-2026"
  name: string; // "Academias · Clausura 2026"
  year: number;
  status: TournamentStatus;
  circuitName: string; // "Academias"
  typeName: string; // "Clausura"
  startsOn: string;
  endsOn: string;
};

export type Category = {
  id: string;
  key: string; // "boys-u10": identificador legible para la URL
  code: string; // "U10"
  name: string; // "Sub-10"
  recognitionMode: RecognitionMode;
  leagueId: string;
  leagueName: string;
  leagueGender: Enums<"league_gender">;
};

export type Team = {
  id: string;
  name: string;
  shortName: string | null;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  categoryId: string;
};

export type Match = {
  id: string;
  categoryId: string;
  tournamentId: string;
  startsAt: string;
  startedAt: string | null; // hora real de inicio (para el minuto en vivo)
  finishedAt: string | null;
  matchday: number | null;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
  home: Team;
  away: Team;
};

type TeamRow = {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string;
  secondary_color: string;
  logo_path: string | null;
  category_id: string;
};

const TEAM_COLUMNS = "id, name, short_name, primary_color, secondary_color, logo_path, category_id";

function toTeam(t: TeamRow): Team {
  return {
    id: t.id,
    name: t.name,
    shortName: t.short_name,
    primaryColor: t.primary_color,
    secondaryColor: t.secondary_color,
    logoUrl: teamLogoUrl(t.logo_path),
    categoryId: t.category_id,
  };
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`No se pudo cargar ${what}: ${error.message}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID_RE.test(value);

// ---------------------------------------------------------------------------
// Torneos y categorías
// ---------------------------------------------------------------------------
const TOURNAMENT_SELECT = `id, league_id, slug, name, year, status, starts_on, ends_on,
  league:leagues!inner(name),
  circuit:circuits!inner(name),
  type:tournament_types!inner(name)`;

type TournamentRow = {
  id: string;
  league_id: string;
  slug: string;
  name: string;
  year: number;
  status: TournamentStatus;
  starts_on: string;
  ends_on: string;
  league: { name: string };
  circuit: { name: string };
  type: { name: string };
};

function toTournament(t: TournamentRow): Tournament {
  return {
    id: t.id,
    leagueId: t.league_id,
    leagueName: t.league.name,
    slug: t.slug,
    name: t.name,
    year: t.year,
    status: t.status,
    circuitName: t.circuit.name,
    typeName: t.type.name,
    startsOn: t.starts_on,
    endsOn: t.ends_on,
  };
}

/** Orden de presentación: primero los que se juegan, luego los más recientes. */
const TOURNAMENT_ORDER: Record<TournamentStatus, number> = {
  en_curso: 0,
  inscripciones: 1,
  proximo: 2,
  finalizado: 3,
};

function sortTournaments(list: Tournament[]): Tournament[] {
  return [...list].sort(
    (a, b) => TOURNAMENT_ORDER[a.status] - TOURNAMENT_ORDER[b.status] || b.startsOn.localeCompare(a.startsOn),
  );
}

export async function getTournaments(): Promise<Tournament[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("tournaments");

  const { data, error } = await createPublicClient().from("tournaments").select(TOURNAMENT_SELECT);
  if (error) fail("los torneos", error);
  return sortTournaments((data as unknown as TournamentRow[]).map(toTournament));
}

/** Los que se están jugando ahora. Puede haber varios, incluso de la misma liga. */
export async function getCurrentTournaments(): Promise<Tournament[]> {
  return (await getTournaments()).filter((t) => t.status === "en_curso");
}

/** Torneos en los que se juega una categoría, el más relevante primero. */
export async function getTournamentsForCategory(categoryId: string): Promise<Tournament[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("tournaments");

  const { data, error } = await createPublicClient()
    .from("tournament_categories")
    .select(`tournament:tournaments!inner(${TOURNAMENT_SELECT})`)
    .eq("category_id", categoryId);
  if (error) fail("los torneos de la categoría", error);
  return sortTournaments((data as unknown as { tournament: TournamentRow }[]).map((r) => toTournament(r.tournament)));
}

/** Torneo elegido en la URL (?torneo=academias-clausura-2026) o el más relevante. */
export async function resolveTournament(categoryId: string, key: string | string[] | undefined) {
  const tournaments = await getTournamentsForCategory(categoryId);
  const wanted = Array.isArray(key) ? key[0] : key;
  return tournaments.find((t) => t.slug === wanted) ?? tournaments[0] ?? null;
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("categories");

  const { data, error } = await createPublicClient()
    .from("categories")
    .select("id, code, name, recognition_mode, sort_order, league:leagues!inner(id, name, gender, sort_order, is_active)")
    .eq("league.is_active", true);
  if (error) fail("las categorías", error);

  return [...data]
    .sort((a, b) => a.league.sort_order - b.league.sort_order || a.sort_order - b.sort_order)
    .map((c) => ({
      id: c.id,
      key: `${c.league.gender}-${c.code.toLowerCase()}`,
      code: c.code,
      name: c.name,
      recognitionMode: c.recognition_mode,
      leagueId: c.league.id,
      leagueName: c.league.name,
      leagueGender: c.league.gender,
    }));
}

/** Categoría elegida en la URL (?cat=boys-u10) o la primera. */
export async function resolveCategory(key: string | string[] | undefined): Promise<Category | null> {
  const categories = await getCategories();
  const wanted = Array.isArray(key) ? key[0] : key;
  return categories.find((c) => c.key === wanted) ?? categories[0] ?? null;
}

// ---------------------------------------------------------------------------
// Equipos
// ---------------------------------------------------------------------------
export async function getTeams(tournamentId: string): Promise<Team[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("teams");

  const { data, error } = await createPublicClient()
    .from("teams")
    .select(TEAM_COLUMNS)
    .eq("tournament_id", tournamentId)
    .order("name");
  if (error) fail("los equipos", error);
  return data.map(toTeam);
}

/** Equipos de todos los torneos en curso (seguir equipos, avisos, cuenta de familia). */
export async function getCurrentTeams(): Promise<Team[]> {
  const tournaments = await getCurrentTournaments();
  if (!tournaments.length) return [];
  return getTeamsOf(tournaments.map((t) => t.id));
}

async function getTeamsOf(tournamentIds: string[]): Promise<Team[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("teams");

  const { data, error } = await createPublicClient()
    .from("teams")
    .select(TEAM_COLUMNS)
    .in("tournament_id", tournamentIds)
    .order("name");
  if (error) fail("los equipos", error);
  return data.map(toTeam);
}

export type RosterPlayer = {
  playerId: string;
  displayName: string;
  jerseyNumber: number;
  position: string | null;
};

export async function getTeamDetail(teamId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("teams", `team-${teamId}`);

  const supabase = createPublicClient();
  const { data: team, error } = await supabase
    .from("teams")
    .select(`${TEAM_COLUMNS}, tournament_id`)
    .eq("id", teamId)
    .maybeSingle();
  if (error) fail("el equipo", error);
  if (!team) return null;

  const { data: roster, error: rosterError } = await supabase
    .from("roster_entries")
    .select("player_id, jersey_number, position")
    .eq("team_id", teamId)
    .order("jersey_number");
  if (rosterError) fail("el plantel", rosterError);

  const names = await getPlayerNames(roster.map((r) => r.player_id));
  const players: RosterPlayer[] = roster.map((r) => ({
    playerId: r.player_id,
    displayName: names.get(r.player_id) ?? "Jugador",
    jerseyNumber: r.jersey_number,
    position: r.position,
  }));

  return { team: toTeam(team), tournamentId: team.tournament_id, players };
}

/** Nombres públicos (nombre + inicial) desde la vista public_players. */
async function getPlayerNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await createPublicClient()
      .from("public_players")
      .select("id, display_name")
      .in("id", unique.slice(i, i + 200));
    if (error) fail("los nombres de jugadores", error);
    for (const p of data) if (p.id && p.display_name) map.set(p.id, p.display_name);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Partidos
// ---------------------------------------------------------------------------
// La jornada ya no es un número en el partido: es una fila de `matchdays`.
const MATCH_SELECT = `id, category_id, tournament_id, starts_at, started_at, finished_at, status, home_score, away_score,
  matchday:matchdays(number),
  venue:venues(name),
  home:teams!matches_home_team_fkey(${TEAM_COLUMNS}),
  away:teams!matches_away_team_fkey(${TEAM_COLUMNS})`;

type MatchRow = {
  id: string;
  category_id: string;
  tournament_id: string;
  starts_at: string;
  started_at: string | null;
  finished_at: string | null;
  matchday: { number: number } | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  venue: { name: string } | null;
  home: TeamRow;
  away: TeamRow;
};

function toMatch(m: MatchRow): Match {
  return {
    id: m.id,
    categoryId: m.category_id,
    tournamentId: m.tournament_id,
    startsAt: m.starts_at,
    startedAt: m.started_at,
    finishedAt: m.finished_at,
    matchday: m.matchday?.number ?? null,
    status: m.status,
    homeScore: m.home_score,
    awayScore: m.away_score,
    venue: m.venue?.name ?? null,
    home: toTeam(m.home),
    away: toTeam(m.away),
  };
}

/** Partidos del torneo; opcionalmente de una categoría o un equipo. */
export async function getMatches(opts: { tournamentId: string; categoryId?: string; teamId?: string }): Promise<Match[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("matches");

  let query = createPublicClient().from("matches").select(MATCH_SELECT).eq("tournament_id", opts.tournamentId);
  if (opts.categoryId) query = query.eq("category_id", opts.categoryId);
  if (opts.teamId) query = query.or(`home_team_id.eq.${opts.teamId},away_team_id.eq.${opts.teamId}`);

  const { data, error } = await query.order("starts_at").order("id");
  if (error) fail("los partidos", error);
  return (data as unknown as MatchRow[]).map(toMatch);
}

/** Para Inicio: en vivo, próximos y últimos resultados de todos los torneos en curso. */
export async function getHomeMatches(tournamentIds: string[], limit = 6) {
  "use cache";
  cacheLife("minutes");
  cacheTag("matches");

  const supabase = createPublicClient();
  const [live, upcoming, recent] = await Promise.all([
    supabase.from("matches").select(MATCH_SELECT).in("tournament_id", tournamentIds).eq("status", "live").order("starts_at"),
    supabase.from("matches").select(MATCH_SELECT).in("tournament_id", tournamentIds).eq("status", "scheduled")
      .order("starts_at").order("id").limit(limit),
    supabase.from("matches").select(MATCH_SELECT).in("tournament_id", tournamentIds).eq("status", "finished")
      .order("starts_at", { ascending: false }).order("id").limit(limit),
  ]);
  for (const r of [live, upcoming, recent]) if (r.error) fail("los partidos", r.error);

  const map = (rows: unknown) => (rows as MatchRow[]).map(toMatch);
  return { live: map(live.data), upcoming: map(upcoming.data), recent: map(recent.data) };
}

export type MatchEvent = {
  id: string;
  teamId: string;
  code: string; // goal, assist, save, fair_play, own_goal…
  minute: number | null;
  playerName: string | null; // null en U6/U8 (sin destacar individuos)
};

export async function getMatchDetail(matchId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("matches", `match-${matchId}`);

  const supabase = createPublicClient();
  const { data: row, error } = await supabase.from("matches").select(MATCH_SELECT).eq("id", matchId).maybeSingle();
  if (error) fail("el partido", error);
  if (!row) return null;
  const match = toMatch(row as unknown as MatchRow);

  const categories = await getCategories();
  const category = categories.find((c) => c.id === match.categoryId) ?? null;
  const individual = category?.recognitionMode === "individual_ranking";

  // Eventos visibles en público (las atajadas no, para no saturar la línea de tiempo).
  const [{ data: events, error: eventsError }, { data: mvps, error: mvpError }, { data: chronicle }] =
    await Promise.all([
      supabase
        .from("match_events")
        .select("id, team_id, player_id, minute, event_type:event_types!inner(code)")
        .eq("match_id", matchId)
        .is("voided_at", null)
        .in("event_type.code", ["goal", "own_goal", "assist", "fair_play", "yellow_card", "red_card"])
        .order("minute", { nullsFirst: false })
        .order("created_at"),
      supabase.from("match_mvps").select("team_id, player_id").eq("match_id", matchId),
      supabase.from("match_chronicles").select("body, published_at").eq("match_id", matchId).maybeSingle(),
    ]);
  if (eventsError) fail("los eventos", eventsError);
  if (mvpError) fail("el MVP", mvpError);

  // Nombres: en U10+ para la línea de tiempo y el MVP; en U6/U8 solo para el MVP.
  const names = await getPlayerNames([...(individual ? events.map((e) => e.player_id) : []), ...mvps.map((m) => m.player_id)]);

  const timeline: MatchEvent[] = events.map((e) => ({
    id: e.id,
    teamId: e.team_id,
    code: e.event_type.code,
    minute: e.minute,
    playerName: individual ? (names.get(e.player_id) ?? null) : null,
  }));

  // MVP en todas las categorías (decisión 2026-11-13), también U6/U8.
  const mvpByTeam = Object.fromEntries(mvps.map((m) => [m.team_id, names.get(m.player_id) ?? null]));

  // Votación MVP de las familias (si la liga la usa)
  const { data: league } = await supabase
    .from("categories")
    .select("league:leagues(mvp_mode, mvp_vote_hours)")
    .eq("id", match.categoryId)
    .maybeSingle();
  const voting =
    league?.league?.mvp_mode === "parent_vote" && match.status === "finished" && match.finishedAt
      ? { closesAt: new Date(new Date(match.finishedAt).getTime() + league.league.mvp_vote_hours * 3600_000).toISOString() }
      : null;

  return { match, category, timeline, mvpByTeam, chronicle: chronicle?.body ?? null, voting };
}

/** Planteles de los dos equipos de un partido (datos públicos: nombre + inicial). */
export async function getMatchRosters(homeId: string, awayId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("teams", `team-${homeId}`, `team-${awayId}`);

  const { data, error } = await createPublicClient()
    .from("roster_entries")
    .select("player_id, team_id, jersey_number")
    .in("team_id", [homeId, awayId])
    .order("jersey_number");
  if (error) fail("los planteles", error);
  const names = await getPlayerNames(data.map((r) => r.player_id));
  return data.map((r) => ({ playerId: r.player_id, teamId: r.team_id, number: r.jersey_number, name: names.get(r.player_id) ?? "Jugador" }));
}

export type MatchScorer = { teamId: string; name: string; goals: number; minute: number | null };

/**
 * Goleadores de un partido, para la tarjeta de resultado.
 * La vista `public_match_scorers` ya excluye en SQL las categorías en modo
 * `team_stars` y solo expone "nombre + inicial": aquí no hay que filtrar nada.
 */
export async function getMatchScorers(matchId: string): Promise<MatchScorer[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("matches", `match-${matchId}`);

  const { data, error } = await createPublicClient()
    .from("public_match_scorers")
    .select("team_id, display_name, goals, first_minute")
    .eq("match_id", matchId);
  if (error) fail("los goleadores", error);

  return data
    .filter((r) => r.team_id && r.display_name)
    .map((r) => ({ teamId: r.team_id!, name: r.display_name!, goals: r.goals ?? 1, minute: r.first_minute }))
    .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999) || a.name.localeCompare(b.name, "es"));
}

// ---------------------------------------------------------------------------
// Estadísticas
// ---------------------------------------------------------------------------
export type StandingRow = {
  position: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export async function getStandings(tournamentId: string, categoryId: string): Promise<StandingRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("matches", "standings");

  const supabase = createPublicClient();
  const [{ data, error }, teams] = await Promise.all([
    supabase.from("standings").select("*").eq("tournament_id", tournamentId).eq("category_id", categoryId)
      .order("position").order("team_id"),
    getTeams(tournamentId),
  ]);
  if (error) fail("la tabla de posiciones", error);
  const byId = new Map(teams.map((t) => [t.id, t]));

  return data.flatMap((r) => {
    const team = r.team_id ? byId.get(r.team_id) : undefined;
    if (!team) return [];
    return [{
      position: r.position ?? 0,
      team,
      played: r.played ?? 0,
      won: r.won ?? 0,
      drawn: r.drawn ?? 0,
      lost: r.lost ?? 0,
      goalsFor: r.goals_for ?? 0,
      goalsAgainst: r.goals_against ?? 0,
      goalDifference: r.goal_difference ?? 0,
      points: r.points ?? 0,
    }];
  });
}

export const LEADER_STATS = [
  { stat: "goals", label: "Goleadores", unit: "goles" },
  { stat: "assists", label: "Asistencias", unit: "asistencias" },
  { stat: "mvps", label: "Jugador del partido", unit: "MVP" },
  { stat: "saves", label: "Atajadas", unit: "atajadas" },
  { stat: "fair_play", label: "Fair play", unit: "reconocimientos" },
] as const;

export type LeaderRow = { position: number; playerName: string; team: Team; value: number };

/** Líderes por estadística. Vacío en U6/U8: la vista los excluye desde la BD. */
export async function getLeaders(tournamentId: string, categoryId: string, top = 5) {
  "use cache";
  cacheLife("minutes");
  cacheTag("matches", "leaders");

  const supabase = createPublicClient();
  const [{ data, error }, teams] = await Promise.all([
    supabase.from("season_leaders").select("*").eq("tournament_id", tournamentId).eq("category_id", categoryId)
      .lte("position", top).order("position").order("player_id"),
    getTeams(tournamentId),
  ]);
  if (error) fail("los líderes", error);

  const names = await getPlayerNames(data.flatMap((r) => (r.player_id ? [r.player_id] : [])));
  const byId = new Map(teams.map((t) => [t.id, t]));
  const result: Record<string, LeaderRow[]> = {};
  for (const r of data) {
    const team = r.team_id ? byId.get(r.team_id) : undefined;
    if (!r.stat || !r.player_id || !team) continue;
    (result[r.stat] ??= []).push({
      position: r.position ?? 0,
      playerName: names.get(r.player_id) ?? "Jugador",
      team,
      value: r.value ?? 0,
    });
  }
  return result;
}

export type TeamRecognition = { team: Team; stars: number; goals: number; fairPlay: number };

/** Reconocimientos de equipo (todas las categorías; protagonistas en U6/U8). */
export async function getTeamRecognitions(tournamentId: string, categoryId: string): Promise<TeamRecognition[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("matches", "recognitions");

  const supabase = createPublicClient();
  const [{ data, error }, teams] = await Promise.all([
    supabase.from("team_season_recognitions").select("*").eq("tournament_id", tournamentId).eq("category_id", categoryId),
    getTeams(tournamentId),
  ]);
  if (error) fail("los reconocimientos", error);
  const byId = new Map(teams.map((t) => [t.id, t]));

  return data
    .flatMap((r) => {
      const team = r.team_id ? byId.get(r.team_id) : undefined;
      return team ? [{ team, stars: r.stars ?? 0, goals: r.goals ?? 0, fairPlay: r.fair_play ?? 0 }] : [];
    })
    .sort((a, b) => a.team.name.localeCompare(b.team.name, "es"));
}

export type PlayerStatLine = { goals: number; assists: number; mvps: number; saves: number; points: number };

/** Estadísticas del plantel de un equipo (solo U10+; vacío en U6/U8). */
export async function getTeamPlayerStats(tournamentId: string, teamId: string): Promise<Record<string, PlayerStatLine>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("matches", `team-${teamId}`);

  const { data, error } = await createPublicClient()
    .from("player_season_stats")
    .select("player_id, goals, assists, mvps, saves, points")
    .eq("tournament_id", tournamentId)
    .eq("team_id", teamId);
  if (error) fail("las estadísticas del equipo", error);

  return Object.fromEntries(
    data.flatMap((r) =>
      r.player_id
        ? [[r.player_id, { goals: r.goals ?? 0, assists: r.assists ?? 0, mvps: r.mvps ?? 0, saves: r.saves ?? 0, points: r.points ?? 0 }]]
        : [],
    ),
  );
}
