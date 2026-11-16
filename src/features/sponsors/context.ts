import "server-only";
import { getOrganizationId, type Category, type Tournament } from "@/features/league/data";
import type { SponsorContext } from "./pick";

/**
 * Dónde está parado el visitante, en términos de ámbitos de patrocinio.
 *
 * Se pasa entero aunque la página solo use un espacio: la regla elige el
 * ámbito más específico que tenga asignación, y para eso necesita la cadena
 * completa (categoría → torneo → circuito → liga → organización).
 */
export async function sponsorContext({
  tournament,
  category,
}: {
  tournament?: Tournament | null;
  category?: Category | null;
}): Promise<SponsorContext> {
  return {
    organizacion: (await getOrganizationId()) ?? undefined,
    liga: tournament?.leagueId ?? category?.leagueId,
    circuito: tournament?.circuitId,
    torneo: tournament?.id,
    categoria: category?.id,
  };
}
