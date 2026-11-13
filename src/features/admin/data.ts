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

export async function getSeasons() {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, year, number, name, starts_on, ends_on, is_current, closed_at")
    .order("year", { ascending: false })
    .order("number", { ascending: false });
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

export async function getDashboardCounts(seasonId: string) {
  const supabase = await adminClient();
  const count = async (table: "teams" | "roster_entries" | "families" | "profiles" | "matches", filter?: [string, string]) => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) q = q.eq(filter[0], filter[1]);
    const { count: n, error } = await q;
    if (error) throw error;
    return n ?? 0;
  };
  const [teams, players, families, users, matches] = await Promise.all([
    count("teams", ["season_id", seasonId]),
    count("roster_entries", ["season_id", seasonId]),
    count("families"),
    count("profiles"),
    count("matches", ["season_id", seasonId]),
  ]);

  // Próximos partidos sin delegado asignado
  const { data: upcoming, error } = await supabase
    .from("matches")
    .select("id, match_officials(user_id)")
    .eq("season_id", seasonId)
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
       roster_entries(id, team_id, season_id, jersey_number, position, team:teams(id, name, category_id)),
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
       family_players(player:players(id, display_name, roster_entries(jersey_number, team:teams(name, season_id))))`,
    )
    .eq("id", familyId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Busca jugadores inscritos en la temporada por nombre (para vincular a una familia). */
export async function searchPlayers(seasonId: string, term: string) {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("roster_entries")
    .select("player_id, jersey_number, team:teams!inner(name), player:players!inner(display_name, first_name)")
    .eq("season_id", seasonId)
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
      `id, season_id, category_id, home_team_id, away_team_id, venue_id, starts_at, matchday, status,
       home_score, away_score, notes, match_officials(user_id, role)`,
    )
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
