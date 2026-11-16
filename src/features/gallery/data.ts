import "server-only";
import type { Enums } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

/**
 * Lecturas de la galería, siempre con la sesión del usuario: quién ve qué lo
 * decide RLS (`can_view_media`), no este archivo. Una familia de la liga ve lo
 * aprobado y sin niños bloqueados; quien subió algo ve lo suyo; el admin, todo.
 *
 * Las URLs son firmadas y caducan: nunca se expone una ruta pública.
 */

const SIGNED_URL_SECONDS = 3600;

type TournamentStatus = Enums<"tournament_status">;
type LeagueGender = Enums<"league_gender">;

export type GalleryItem = {
  id: string;
  matchId: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  url: string | null;
  thumbUrl: string | null;
  /** "Tigres FC vs Leones FC": el partido donde se tomó. */
  matchLabel: string | null;
  /** Quienes aparecen, como nombre + inicial. Nunca los recortados. */
  players: string[];
};

type Row = {
  id: string;
  match_id: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  storage_path: string | null;
  thumbnail_path: string | null;
};

/** Firma en lote las rutas de un conjunto de archivos. */
async function sign(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return map;
  const { data } = await supabase.storage.from("match-media").createSignedUrls(unique, SIGNED_URL_SECONDS);
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

async function toItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Row[],
): Promise<GalleryItem[]> {
  const urls = await sign(supabase, rows.flatMap((r) => [r.storage_path, r.thumbnail_path].filter((p): p is string => !!p)));
  return rows.map((r) => ({
    id: r.id,
    matchId: r.match_id,
    caption: r.caption,
    width: r.width,
    height: r.height,
    url: r.storage_path ? (urls.get(r.storage_path) ?? null) : null,
    thumbUrl: r.thumbnail_path ? (urls.get(r.thumbnail_path) ?? null) : null,
    matchLabel: null,
    players: [],
  }));
}

const ITEM_COLUMNS = "id, match_id, caption, width, height, storage_path, thumbnail_path";

/** Fotos aprobadas de un partido, para la página del partido. */
export async function getMatchGallery(matchId: string): Promise<GalleryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_items")
    .select(ITEM_COLUMNS)
    .eq("match_id", matchId)
    .eq("status", "approved")
    .order("created_at");
  if (error || !data) return [];
  return toItems(supabase, data as Row[]);
}

export type MatchdayGallery = {
  matchdayId: string;
  number: number;
  playedOn: string | null;
  tournamentName: string;
  leagueName: string;
  items: GalleryItem[];
};

export type GalleryTournament = {
  id: string;
  slug: string;
  name: string;
  year: number;
  status: TournamentStatus;
  leagueName: string;
  leagueGender: LeagueGender;
  photos: number;
};

export type GalleryFilters = { tournamentIds?: string[]; leagueGender?: LeagueGender };

/**
 * Los torneos que tienen fotos aprobadas, para el selector: el que se juega
 * primero y después los anteriores. Se cuentan desde las fotos que esta
 * persona puede ver, así que una familia nunca ve un torneo vacío para ella.
 */
export async function getGalleryTournaments(): Promise<GalleryTournament[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_items")
    .select(
      `id,
       match:matches!inner(
         tournament:tournaments!inner(id, slug, name, year, status, league:leagues!inner(name, gender)))`,
    )
    .eq("status", "approved")
    .limit(2000);
  if (error || !data) return [];

  type Joined = {
    match: {
      tournament: {
        id: string;
        slug: string;
        name: string;
        year: number;
        status: TournamentStatus;
        league: { name: string; gender: LeagueGender } | null;
      } | null;
    } | null;
  };

  const byId = new Map<string, GalleryTournament>();
  for (const row of data as unknown as Joined[]) {
    const t = row.match?.tournament;
    if (!t) continue;
    const entry = byId.get(t.id) ?? {
      id: t.id,
      slug: t.slug,
      name: t.name,
      year: t.year,
      status: t.status,
      leagueName: t.league?.name ?? "",
      leagueGender: t.league?.gender ?? "boys",
      photos: 0,
    };
    entry.photos += 1;
    byId.set(t.id, entry);
  }

  return [...byId.values()].sort(
    (a, b) =>
      Number(b.status === "en_curso") - Number(a.status === "en_curso") ||
      b.year - a.year ||
      a.name.localeCompare(b.name, "es"),
  );
}

/**
 * Galería agrupada por jornada, que es como la vive una familia: "las fotos del
 * sábado pasado", no "las fotos del partido tal". Se puede acotar a un torneo
 * y a una liga; sin filtros trae lo más reciente de todo.
 */
export async function getGalleryByMatchday(
  filters: GalleryFilters = {},
  limitMatchdays = 6,
): Promise<MatchdayGallery[]> {
  const supabase = await createClient();

  let query = supabase
    .from("media_items")
    .select(
      `${ITEM_COLUMNS},
       match:matches!inner(
         tournament_id,
         home:teams!matches_home_team_fkey(name),
         away:teams!matches_away_team_fkey(name),
         matchday:matchdays!inner(id, number, played_on),
         tournament:tournaments!inner(name, league:leagues!inner(name, gender)))`,
    )
    .eq("status", "approved");
  if (filters.tournamentIds?.length) query = query.in("match.tournament_id", filters.tournamentIds);
  if (filters.leagueGender) query = query.eq("match.tournament.league.gender", filters.leagueGender);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(300);
  if (error || !data) return [];

  type Joined = Row & {
    match: {
      home: { name: string } | null;
      away: { name: string } | null;
      matchday: { id: string; number: number; played_on: string | null } | null;
      tournament: { name: string; league: { name: string } | null } | null;
    } | null;
  };

  const groups = new Map<string, MatchdayGallery & { rows: Row[] }>();
  const labels = new Map<string, string | null>();
  for (const row of data as unknown as Joined[]) {
    const matchday = row.match?.matchday;
    if (!matchday) continue;
    const group = groups.get(matchday.id) ?? {
      matchdayId: matchday.id,
      number: matchday.number,
      playedOn: matchday.played_on,
      tournamentName: row.match?.tournament?.name ?? "",
      leagueName: row.match?.tournament?.league?.name ?? "",
      items: [],
      rows: [],
    };
    group.rows.push(row);
    groups.set(matchday.id, group);
    const home = row.match?.home?.name;
    const away = row.match?.away?.name;
    labels.set(row.id, home && away ? `${home} vs ${away}` : null);
  }

  const ordered = [...groups.values()]
    .sort((a, b) => (b.playedOn ?? "").localeCompare(a.playedOn ?? "") || b.number - a.number)
    .slice(0, limitMatchdays);

  // Una sola firma para todas las fotos que se van a mostrar
  const rows = ordered.flatMap((g) => g.rows);
  const all = await toItems(supabase, rows);
  const appearing = await getAppearances(supabase, rows.map((r) => r.id));
  const byId = new Map(
    all.map((i) => [i.id, { ...i, matchLabel: labels.get(i.id) ?? null, players: appearing.get(i.id) ?? [] }]),
  );
  return ordered.map(({ rows: groupRows, ...group }) => ({
    ...group,
    items: groupRows.flatMap((r) => (byId.has(r.id) ? [byId.get(r.id)!] : [])),
  }));
}

/**
 * Quiénes aparecen en cada foto, como nombre + inicial.
 *
 * Se excluyen las etiquetas `redacted`: a ese niño el admin lo recortó o lo
 * difuminó justamente porque no hay consentimiento, así que nombrarlo diría
 * lo que la foto ya no dice.
 */
async function getAppearances(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mediaIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (!mediaIds.length) return result;

  const { data: tags } = await supabase
    .from("media_tags")
    .select("media_id, player_id")
    .in("media_id", mediaIds)
    .eq("redacted", false);
  if (!tags?.length) return result;

  const { data: players } = await supabase
    .from("public_players")
    .select("id, display_name")
    .in("id", [...new Set(tags.map((t) => t.player_id))]);
  const nameOf = new Map((players ?? []).flatMap((p) => (p.id ? [[p.id, p.display_name ?? "Jugador"] as const] : [])));

  for (const tag of tags) {
    const name = nameOf.get(tag.player_id);
    if (!name) continue;
    result.set(tag.media_id, [...(result.get(tag.media_id) ?? []), name]);
  }
  for (const [id, names] of result) result.set(id, names.sort((a, b) => a.localeCompare(b, "es")));
  return result;
}

/** Jugadores que se pueden etiquetar en un partido: los de los dos planteles. */
export async function getTaggablePlayers(matchId: string) {
  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id, home:teams!matches_home_team_fkey(name), away:teams!matches_away_team_fkey(name)")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return [];

  const { data: roster } = await supabase
    .from("roster_entries")
    .select("player_id, team_id, jersey_number")
    .in("team_id", [match.home_team_id, match.away_team_id])
    .order("jersey_number");
  if (!roster?.length) return [];

  const { data: players } = await supabase
    .from("public_players")
    .select("id, display_name")
    .in("id", roster.map((r) => r.player_id));
  const nameOf = new Map((players ?? []).map((p) => [p.id, p.display_name]));

  return roster.map((r) => ({
    playerId: r.player_id,
    name: nameOf.get(r.player_id) ?? "Jugador",
    jerseyNumber: r.jersey_number,
    teamName: r.team_id === match.home_team_id ? match.home?.name : match.away?.name,
  }));
}

/** ¿Puede esta persona subir fotos a este partido? Lo responde la base. */
export async function canUploadTo(matchId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_upload_media", { p_match_id: matchId });
  return data === true;
}

/** Cola de revisión del admin: pendientes y aprobados que quedaron bloqueados. */
export async function getReviewQueue() {
  await requireRole(["admin"], "/admin");
  const supabase = await createClient();

  const { data: queue, error } = await supabase
    .from("media_review_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);
  if (error || !queue?.length) return [];

  const ids = queue.flatMap((q) => (q.id ? [q.id] : []));
  const [{ data: tags }, { data: matches }] = await Promise.all([
    supabase
      .from("media_tags")
      .select("media_id, player_id, redacted, player:players(display_name, photo_consent)")
      .in("media_id", ids),
    supabase
      .from("matches")
      .select("id, starts_at, home:teams!matches_home_team_fkey(name), away:teams!matches_away_team_fkey(name)")
      .in("id", queue.flatMap((q) => (q.match_id ? [q.match_id] : []))),
  ]);

  const urls = await sign(supabase, queue.flatMap((q) => [q.storage_path, q.thumbnail_path].filter((p): p is string => !!p)));
  const matchById = new Map((matches ?? []).map((m) => [m.id, m]));

  return queue.map((q) => ({
    id: q.id!,
    matchId: q.match_id!,
    status: q.status!,
    createdAt: q.created_at!,
    blockingTags: q.blocking_tags ?? 0,
    url: q.storage_path ? (urls.get(q.storage_path) ?? null) : null,
    match: matchById.get(q.match_id!) ?? null,
    tags: (tags ?? [])
      .filter((t) => t.media_id === q.id)
      .map((t) => ({
        playerId: t.player_id,
        name: t.player?.display_name ?? "Jugador",
        consent: t.player?.photo_consent ?? false,
        redacted: t.redacted,
      })),
  }));
}
