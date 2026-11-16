import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import sharp from "sharp";
import { getCategories, getTournaments } from "@/features/league/data";
import { sponsorContext } from "@/features/sponsors/context";
import { getActiveSponsors } from "@/features/sponsors/data";
import { pickSponsor } from "@/features/sponsors/pick";
import { requireUser } from "@/lib/auth";
import { teamLogoUrl } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import type { CertificateData, CertificateStat } from "./certificate";

/**
 * Certificados de la familia.
 *
 * Todo sale de `my_family_tournament_certificates`, que solo devuelve torneos
 * ya finalizados y solo los hijos de quien pregunta (RLS, no el código). En las
 * categorías en modo `team_stars` la propia vista devuelve `null` en las
 * cifras: aquí no hay nada que ocultar porque nunca llegan.
 *
 * `display_name` es una columna generada = "Carlos M.": el certificado no puede
 * mostrar el apellido completo ni queriendo.
 */

const SELECT =
  "player_id, display_name, team_id, team_name, primary_color, logo_path, category_id, category_name, league_name, tournament_id, tournament_name, season_year, recognition_mode, matches_played, goals, assists, mvps, stars, participated";

export type CertificateRow = {
  playerId: string;
  name: string;
  teamName: string;
  categoryLabel: string;
  tournamentName: string;
  tournamentId: string;
  year: number;
};

/** Lo que se puede descargar hoy, para la lista de /familia. */
export async function getMyCertificates(): Promise<CertificateRow[]> {
  await requireUser("/familia");
  const supabase = await createClient();

  const { data, error } = await supabase.from("my_family_tournament_certificates").select(SELECT);
  if (error) throw error;

  const categories = await getCategories();
  const rows = (data ?? []).flatMap((row) => {
    if (!row.player_id || !row.tournament_id) return [];
    const category = categories.find((c) => c.id === row.category_id);
    return [
      {
        playerId: row.player_id,
        name: row.display_name ?? "Jugador",
        teamName: row.team_name ?? "",
        categoryLabel: `${row.league_name ?? ""} ${category?.code ?? row.category_name ?? ""}`.trim(),
        tournamentName: row.tournament_name ?? "",
        tournamentId: row.tournament_id,
        year: row.season_year ?? new Date().getFullYear(),
      },
    ];
  });

  // El más reciente primero, y los hermanos juntos
  rows.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name, "es") || a.tournamentName.localeCompare(b.tournamentName, "es"));
  return rows;
}

/**
 * El certificado de un hijo en un torneo, listo para dibujar.
 * Devuelve null si la vista no lo trae: o no es hijo de esta familia, o el
 * torneo todavía no terminó. Las dos respuestas son la misma a propósito.
 */
export async function getCertificateData(
  playerId: string,
  tournamentId: string,
): Promise<{ data: CertificateData; sponsorPlacementId: string | null; fileName: string } | null> {
  await requireUser("/familia");
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("my_family_tournament_certificates")
    .select(SELECT)
    .eq("player_id", playerId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const [categories, tournaments] = await Promise.all([getCategories(), getTournaments()]);
  const category = categories.find((c) => c.id === row.category_id);
  const tournament = tournaments.find((t) => t.id === row.tournament_id);

  const stats: CertificateStat[] = [];
  // En `team_stars` la vista devuelve null en todas: la lista queda vacía y la
  // plantilla cambia a participación y valores.
  if (row.matches_played !== null) stats.push({ label: "Partidos", value: row.matches_played });
  if (row.goals !== null) stats.push({ label: "Goles", value: row.goals });
  if (row.assists !== null) stats.push({ label: "Asistencias", value: row.assists });
  if (row.mvps !== null) stats.push({ label: "MVP", value: row.mvps });
  if (row.stars !== null) stats.push({ label: "Estrellas", value: row.stars });

  const placement = pickSponsor(
    await getActiveSponsors(),
    "certificado",
    await sponsorContext({ tournament, category }),
  );

  const name = row.display_name ?? "Jugador";
  const year = row.season_year ?? new Date().getFullYear();

  return {
    sponsorPlacementId: placement?.id ?? null,
    fileName: safeFileName(`Certificado ${name} ${year}`),
    data: {
      name,
      teamName: row.team_name ?? "",
      teamColor: row.primary_color ?? "#0A2250",
      teamLogo: await loadPng(row.team_id ?? "", teamLogoUrl(row.logo_path)),
      heading: `${row.league_name ?? ""} · ${category?.code ?? row.category_name ?? ""}`,
      tournamentName: row.tournament_name ?? "",
      year,
      stats,
      sponsor: placement
        ? {
            name: placement.sponsorName,
            text: placement.text,
            logo: await loadPng(`sponsor-${placement.id}`, placement.imageUrl ?? placement.logoDarkUrl),
          }
        : null,
    },
  };
}

/**
 * Imagen lista para Satori. Dos motivos para no pasarle la URL:
 * 1. Los logos se guardan en WebP y el rasterizador de `next/og` no lo lee.
 * 2. Si la descarga falla, el certificado entero se rompería; así se cae al
 *    color del equipo (o al nombre del patrocinador) sin reventar el PDF.
 */
async function loadPng(key: string, url: string | null): Promise<string | null> {
  "use cache";
  cacheLife("days");
  cacheTag("teams", "sponsors", `logo-${key}`);

  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const png = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(480, 240, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/** El nombre del archivo que descarga la familia, sin acentos ni sorpresas. */
function safeFileName(text: string) {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9 ._-]/g, "")
      .replace(/\s+/g, " ")
      .trim() || "Certificado"
  );
}
