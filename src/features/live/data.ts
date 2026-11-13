import "server-only";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Lecturas de la consola del delegado (con sesión, sin caché: siempre frescas).
 * Next ejecuta layout y página en paralelo: cada lectura verifica el rol primero.
 * RLS y las RPC imponen que el delegado solo cargue SUS partidos asignados.
 */
async function liveClient() {
  const user = await requireRole(["delegate", "admin"], "/delegado");
  return { supabase: await createClient(), user };
}

const TEAM = "id, name, short_name, primary_color, secondary_color";

export async function getMyMatches() {
  const { supabase, user } = await liveClient();

  // Delegado: sus partidos asignados. Admin: además, todos los partidos de hoy y en vivo.
  const { data: assigned, error } = await supabase
    .from("match_officials")
    .select("match_id")
    .eq("user_id", user.id);
  if (error) throw error;
  const ids = assigned.map((a) => a.match_id);

  let query = supabase
    .from("matches")
    .select(
      `id, starts_at, started_at, status, home_score, away_score, matchday,
       category:categories(code, league:leagues(name)),
       venue:venues(name),
       home:teams!matches_home_team_id_season_id_category_id_fkey(${TEAM}),
       away:teams!matches_away_team_id_season_id_category_id_fkey(${TEAM})`,
    )
    .order("starts_at");

  if (user.role === "admin") {
    const dayStart = new Date(Date.now() - 5 * 3600_000); // hoy en Panamá (UTC−5), con margen
    dayStart.setUTCHours(5, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
    const inList = ids.length ? `,id.in.(${ids.join(",")})` : "";
    query = query.or(
      `status.eq.live,and(starts_at.gte.${dayStart.toISOString()},starts_at.lt.${dayEnd.toISOString()})${inList}`,
    );
  } else {
    if (!ids.length) return { user, matches: [] };
    query = query.in("id", ids);
  }

  const { data, error: matchesError } = await query;
  if (matchesError) throw matchesError;
  return { user, matches: data };
}

export type LivePlayer = { playerId: string; name: string; number: number; position: string | null; present: boolean };

export async function getLiveMatch(matchId: string) {
  const { supabase, user } = await liveClient();

  const { data: match, error } = await supabase
    .from("matches")
    .select(
      `id, season_id, starts_at, started_at, finished_at, status, home_score, away_score, matchday,
       category:categories(code, recognition_mode, league:leagues(name, mvp_mode, mvp_vote_hours)),
       venue:venues(name),
       home:teams!matches_home_team_id_season_id_category_id_fkey(${TEAM}),
       away:teams!matches_away_team_id_season_id_category_id_fkey(${TEAM}),
       match_officials(user_id)`,
    )
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  if (!match) return null;

  const canEdit = user.role === "admin" || match.match_officials.some((o) => o.user_id === user.id);

  const [rosters, attendance, events, mvps, eventTypes] = await Promise.all([
    supabase
      .from("roster_entries")
      .select("player_id, team_id, jersey_number, position")
      .in("team_id", [match.home.id, match.away.id])
      .order("jersey_number"),
    supabase.from("match_attendance").select("player_id").eq("match_id", matchId),
    supabase
      .from("match_events")
      .select("id, team_id, player_id, minute, voided_at, created_at, event_type:event_types(code, name)")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false }),
    supabase.from("match_mvps").select("team_id, player_id, source").eq("match_id", matchId),
    supabase.from("event_types").select("id, code, name").eq("is_award", false),
  ]);
  for (const r of [rosters, attendance, events, mvps, eventTypes]) if (r.error) throw r.error;

  // Nombres públicos (nombre + inicial): el delegado no lee la tabla privada de jugadores.
  const playerIds = rosters.data!.map((r) => r.player_id);
  const { data: names, error: namesError } = await supabase
    .from("public_players")
    .select("id, display_name")
    .in("id", playerIds.length ? playerIds : ["00000000-0000-0000-0000-000000000000"]);
  if (namesError) throw namesError;
  const nameById = new Map(names.map((n) => [n.id, n.display_name ?? "Jugador"]));
  const present = new Set(attendance.data!.map((a) => a.player_id));

  const roster = (teamId: string): LivePlayer[] =>
    rosters
      .data!.filter((r) => r.team_id === teamId)
      .map((r) => ({
        playerId: r.player_id,
        name: nameById.get(r.player_id) ?? "Jugador",
        number: r.jersey_number,
        position: r.position,
        present: present.has(r.player_id),
      }));

  return {
    user,
    canEdit,
    match,
    homeRoster: roster(match.home.id),
    awayRoster: roster(match.away.id),
    events: events.data!.map((e) => ({
      id: e.id,
      teamId: e.team_id,
      playerName: nameById.get(e.player_id) ?? "Jugador",
      minute: e.minute,
      code: e.event_type.code,
      label: e.event_type.name,
      voided: e.voided_at !== null,
    })),
    mvps: mvps.data!,
    eventTypes: eventTypes.data!,
  };
}

export type LiveMatchData = NonNullable<Awaited<ReturnType<typeof getLiveMatch>>>;
