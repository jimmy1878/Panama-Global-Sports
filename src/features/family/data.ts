import "server-only";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Lecturas de la cuenta de familia (con sesión, sin caché). RLS deja ver a cada
 * familia SOLO a sus hijos, sus equipos seguidos y su propio voto.
 */

export type Child = {
  playerId: string;
  name: string;
  photoUrl: string | null;
  photoConsent: boolean;
  team: { id: string; name: string; categoryId: string; primaryColor: string; secondaryColor: string; shortName: string | null } | null;
  jerseyNumber: number | null;
  position: string | null;
  stats: { stars: number; goals: number; assists: number; saves: number; fairPlay: number; mvps: number };
};

export async function getMyFamily(currentTournamentIds: string[]) {
  const user = await requireUser("/familia");
  const supabase = await createClient();

  const { data: families, error } = await supabase
    .from("family_members")
    .select("relationship, family:families(id, name, family_players(player_id))")
    .eq("user_id", user.id);
  if (error) throw error;

  const playerIds = [...new Set(families.flatMap((f) => f.family?.family_players.map((p) => p.player_id) ?? []))];
  if (!playerIds.length) return { user, familyNames: families.flatMap((f) => (f.family ? [f.family.name] : [])), children: [] };

  const [players, stars, follows] = await Promise.all([
    supabase
      .from("players")
      .select(
        `id, display_name, photo_path, photo_consent,
         roster_entries(tournament_id, jersey_number, position, team:teams(id, name, short_name, category_id, primary_color, secondary_color))`,
      )
      .in("id", playerIds),
    supabase.from("my_family_player_stars").select("*").in("player_id", playerIds),
    supabase.from("team_follows").select("team_id").eq("user_id", user.id),
  ]);
  for (const r of [players, stars, follows]) if (r.error) throw r.error;

  const children: Child[] = [];
  for (const p of players.data!) {
    // Un niño puede estar inscrito en varios torneos a la vez (academia y colegio)
    const roster =
      p.roster_entries.find((r) => currentTournamentIds.includes(r.tournament_id)) ?? p.roster_entries.at(-1) ?? null;
    const s = stars.data!.filter(
      (x) => x.player_id === p.id && (!currentTournamentIds.length || currentTournamentIds.includes(x.tournament_id!)),
    );
    const sum = (k: "stars" | "goals" | "assists" | "saves" | "fair_play" | "mvps") => s.reduce((acc, x) => acc + (x[k] ?? 0), 0);

    let photoUrl: string | null = null;
    if (p.photo_path) {
      const { data: signed } = await supabase.storage.from("player-photos").createSignedUrl(p.photo_path, 3600);
      photoUrl = signed?.signedUrl ?? null;
    }

    children.push({
      playerId: p.id,
      name: p.display_name ?? "Jugador",
      photoUrl,
      photoConsent: p.photo_consent,
      team: roster?.team
        ? {
            id: roster.team.id,
            name: roster.team.name,
            categoryId: roster.team.category_id,
            primaryColor: roster.team.primary_color,
            secondaryColor: roster.team.secondary_color,
            shortName: roster.team.short_name,
          }
        : null,
      jerseyNumber: roster?.jersey_number ?? null,
      position: roster?.position ?? null,
      stats: {
        stars: sum("stars"),
        goals: sum("goals"),
        assists: sum("assists"),
        saves: sum("saves"),
        fairPlay: sum("fair_play"),
        mvps: sum("mvps"),
      },
    });
  }
  children.sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    user,
    familyNames: families.flatMap((f) => (f.family ? [f.family.name] : [])),
    children,
    followedTeamIds: follows.data!.map((f) => f.team_id),
  };
}

/** ¿El usuario actual sigue este equipo? null si no hay sesión. */
export async function getFollowState(teamId: string): Promise<boolean | null> {
  if (!getSupabaseEnv()) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_follows")
    .select("team_id")
    .eq("user_id", user.id)
    .eq("team_id", teamId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function getFollowedTeamIds(): Promise<string[]> {
  const user = await requireUser("/familia");
  const supabase = await createClient();
  const { data, error } = await supabase.from("team_follows").select("team_id").eq("user_id", user.id);
  if (error) throw error;
  return data.map((d) => d.team_id);
}

/**
 * Estado del voto MVP del usuario en un partido:
 * - "login": votación abierta pero sin sesión
 * - "not-eligible": su familia no tiene hijos en ninguno de los dos equipos
 * - "open": puede votar (excluye a sus propios hijos)
 * - "voted": su familia ya votó (incluye por quién)
 */
export async function getMyVoteState(matchId: string, teamIds: [string, string]) {
  const user = getSupabaseEnv() ? await getCurrentUser() : null;
  if (!user) return { state: "login" as const };
  const supabase = await createClient();

  const [{ data: members, error: mErr }, { data: vote, error: vErr }] = await Promise.all([
    supabase.from("family_members").select("family:families(id, family_players(player_id))").eq("user_id", user.id),
    // Una persona puede estar en dos familias: basta con un voto de cualquiera de ellas.
    supabase.from("mvp_votes").select("player_id, team_id").eq("match_id", matchId).limit(1).maybeSingle(),
  ]);
  if (mErr) throw mErr;
  if (vErr) throw vErr;

  if (vote) return { state: "voted" as const, playerId: vote.player_id };

  const myChildren = new Set(members.flatMap((m) => m.family?.family_players.map((p) => p.player_id) ?? []));
  if (!myChildren.size) return { state: "not-eligible" as const };

  const { data: rosters, error: rErr } = await supabase
    .from("roster_entries")
    .select("player_id")
    .in("team_id", teamIds)
    .in("player_id", [...myChildren]);
  if (rErr) throw rErr;
  if (!rosters.length) return { state: "not-eligible" as const };

  return { state: "open" as const, excludedPlayerIds: [...myChildren] };
}
