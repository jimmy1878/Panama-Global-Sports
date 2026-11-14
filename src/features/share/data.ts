import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import sharp from "sharp";
import { getMatchDetail, getMatchScorers, type Team } from "@/features/league/data";
import { formatLongDay, formatTime } from "@/lib/format";
import type { CardData, CardFormat, CardTeam } from "./card";

/**
 * Datos de la tarjeta de resultado. Todo sale de fuentes públicas
 * (`getMatchDetail` y la vista `public_match_scorers`), así que la imagen no
 * expone nada que no esté ya en la página del partido.
 */

/**
 * Logo del equipo listo para Satori. Dos motivos para no pasarle la URL:
 * 1. Los logos se guardan en WebP y el rasterizador de `next/og` no lo lee.
 * 2. Si la descarga falla, la imagen entera se rompería; así caemos al escudo
 *    de colores sin reventar la tarjeta.
 */
async function loadLogo(teamId: string, url: string | null): Promise<string | null> {
  "use cache";
  cacheLife("days");
  cacheTag("teams", `team-${teamId}`);

  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const png = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(240, 240, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

async function toCardTeam(team: Team): Promise<CardTeam> {
  return {
    name: team.name,
    shortName: team.shortName,
    primaryColor: team.primaryColor,
    secondaryColor: team.secondaryColor,
    logo: await loadLogo(team.id, team.logoUrl),
  };
}

export async function getCardData(matchId: string, format: CardFormat): Promise<CardData | null> {
  const detail = await getMatchDetail(matchId);
  if (!detail) return null;
  const { match, category } = detail;

  const [home, away, scorers] = await Promise.all([
    toCardTeam(match.home),
    toCardTeam(match.away),
    getMatchScorers(matchId),
  ]);

  const heading = [category?.leagueName, category?.code, match.matchday ? `J${match.matchday}` : null]
    .filter(Boolean)
    .join(" · ");

  return {
    format,
    home,
    away,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: match.status,
    heading: heading || "Panama Global Sports",
    day: formatLongDay(match.startsAt),
    time: formatTime(match.startsAt),
    venue: match.venue,
    homeScorers: scorers.filter((s) => s.teamId === match.home.id),
    awayScorers: scorers.filter((s) => s.teamId === match.away.id),
  };
}
