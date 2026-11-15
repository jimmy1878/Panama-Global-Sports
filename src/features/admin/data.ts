import "server-only";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Cliente con sesión, solo para administradores. Next ejecuta layout y página
 * en paralelo, así que el control del layout no basta: cada consulta del panel
 * verifica el rol antes de tocar la base de datos (RLS es la última barrera).
 */
async function adminClient() {
  await requireRole(["admin"], "/admin");
  return createClient();
}

/**
 * Lecturas del panel con la sesión del admin (sin caché: siempre frescas).
 * Para datos públicos ya cacheados, el panel reutiliza src/features/league/data.ts
 * (las acciones los refrescan con updateTag).
 */

export async function getTournaments() {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      `id, year, slug, name, starts_on, ends_on, status, finished_at,
       league:leagues(id, name, slug), circuit:circuits(id, name), type:tournament_types(id, name)`,
    )
    .order("year", { ascending: false })
    .order("starts_on", { ascending: false });
  if (error) throw error;
  return data;
}

/** Catálogos para crear torneos: circuitos y tipos, con las combinaciones válidas. */
export async function getTournamentCatalogs() {
  const supabase = await adminClient();
  const [circuits, types, allowed] = await Promise.all([
    supabase.from("circuits").select("id, slug, name").order("sort_order"),
    supabase.from("tournament_types").select("id, slug, name").order("sort_order"),
    supabase.from("tournament_type_circuits").select("tournament_type_id, circuit_id"),
  ]);
  for (const r of [circuits, types, allowed]) if (r.error) throw r.error;
  return { circuits: circuits.data!, types: types.data!, allowed: allowed.data! };
}

export async function getLeagues() {
  const supabase = await adminClient();
  const { data, error } = await supabase.from("leagues").select("id, name, mvp_mode, mvp_vote_hours").order("sort_order");
  if (error) throw error;
  return data;
}

export async function getVenues() {
  const supabase = await adminClient();
  const { data, error } = await supabase.from("venues").select("id, name, address, maps_url, is_active").order("name");
  if (error) throw error;
  return data;
}

export async function getUsers() {
  const supabase = await adminClient();
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw error;
  return data;
}

export async function getDashboardCounts(tournamentIds: string[]) {
  const supabase = await adminClient();
  const count = async (table: "teams" | "roster_entries" | "families" | "profiles" | "matches", byTournament = false) => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (byTournament) q = q.in("tournament_id", tournamentIds);
    const { count: n, error } = await q;
    if (error) throw error;
    return n ?? 0;
  };
  const [teams, players, families, users, matches] = await Promise.all([
    count("teams", true),
    count("roster_entries", true),
    count("families"),
    count("profiles"),
    count("matches", true),
  ]);

  // Próximos partidos sin delegado asignado
  const { data: upcoming, error } = await supabase
    .from("matches")
    .select("id, match_officials(user_id)")
    .in("tournament_id", tournamentIds)
    .eq("status", "scheduled");
  if (error) throw error;
  const withoutOfficial = upcoming.filter((m) => m.match_officials.length === 0).length;

  return { teams, players, families, users, matches, withoutOfficial };
}

/** Jugador completo (tabla privada; solo admin o su familia pueden leerla). */
export async function getPlayer(playerId: string) {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("players")
    .select(
      `id, first_name, last_initial, display_name, photo_path, photo_consent, photo_consent_updated_at,
       roster_entries(id, team_id, tournament_id, jersey_number, position, team:teams(id, name, category_id)),
       family_players(family:families(id, name))`,
    )
    .eq("id", playerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let photoUrl: string | null = null;
  if (data.photo_path) {
    const { data: signed } = await supabase.storage.from("player-photos").createSignedUrl(data.photo_path, 3600);
    photoUrl = signed?.signedUrl ?? null;
  }
  return { ...data, photoUrl };
}

export async function getFamilies() {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("families")
    .select("id, name, created_at, family_members(user_id), family_players(player_id)")
    .order("name");
  if (error) throw error;
  return data;
}

export async function getFamily(familyId: string) {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("families")
    .select(
      `id, name,
       family_members(user_id, relationship),
       family_players(player:players(id, display_name, roster_entries(jersey_number, team:teams(name, tournament_id))))`,
    )
    .eq("id", familyId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Busca jugadores inscritos en los torneos en curso (para vincular a una familia). */
export async function searchPlayers(tournamentIds: string[], term: string) {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("roster_entries")
    .select("player_id, jersey_number, team:teams!inner(name), player:players!inner(display_name, first_name)")
    .in("tournament_id", tournamentIds)
    .ilike("player.first_name", `%${term.replace(/[%_,()]/g, "")}%`)
    .limit(25);
  if (error) throw error;
  return data;
}

/** Ids de partidos que ya tienen delegado o árbitro asignado. */
export async function getAssignedMatchIds(): Promise<Set<string>> {
  const supabase = await adminClient();
  const { data, error } = await supabase.from("match_officials").select("match_id");
  if (error) throw error;
  return new Set(data.map((o) => o.match_id));
}

export async function getMatchAdmin(matchId: string) {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("matches")
    .select(
      `id, tournament_id, category_id, home_team_id, away_team_id, venue_id, starts_at, matchday:matchdays(number), status,
       home_score, away_score, notes, match_officials(user_id, role)`,
    )
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Crónicas para revisar: los borradores primero, luego las publicadas.
 * Incluye los partidos terminados que todavía no tienen crónica, para poder
 * pedirla a mano si la generación automática falló.
 */
export async function getChronicles() {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("matches")
    .select(
      `id, starts_at, home_score, away_score,
       home:teams!matches_home_team_fkey(name), away:teams!matches_away_team_fkey(name),
       category:categories(code, league:leagues(name)),
       chronicle:match_chronicles(status, body, generated_body, model, generated_at, published_at)`,
    )
    .eq("status", "finished")
    .order("starts_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return data;
}
