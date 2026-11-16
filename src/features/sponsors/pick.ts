/**
 * Qué patrocinador va en un espacio, para una página concreta y para hoy.
 *
 * Archivo neutro (sin "use client" ni "server-only") y sin acceso a datos: le
 * entran las asignaciones vigentes y devuelve una. Así se puede probar sin
 * base de datos, que es lo que hace `npm run test:sponsors`.
 *
 * Reglas de la especificación (sección 5):
 *   · gana el ámbito MÁS ESPECÍFICO: categoría, luego torneo, luego circuito,
 *     luego liga, luego organización. Si la categoría tiene patrocinador, no se
 *     mira la liga: no se acumulan.
 *   · si quedan varias en el mismo nivel, se rotan según `rotationWeight`.
 *   · si no hay ninguna, el espacio no se pinta.
 */

/** Del ámbito más específico al más general: este orden ES la regla. */
export const SPONSOR_SCOPES = ["categoria", "torneo", "circuito", "liga", "organizacion"] as const;

export type SponsorScope = (typeof SPONSOR_SCOPES)[number];

/** Los espacios del catálogo. Los del álbum y el fantasy todavía no se pintan. */
export const SPONSOR_SLOTS = [
  "liga_header",
  "torneo_header",
  "partido_pagina",
  "certificado",
  "album_portada",
  "album_figurita",
  "album_sobre",
  "fantasy_premio",
] as const;

export type SponsorSlotCode = (typeof SPONSOR_SLOTS)[number];

export type SponsorPlacement = {
  id: string;
  slotCode: string;
  scope: SponsorScope;
  scopeId: string;
  priority: number;
  rotationWeight: number;
  text: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  logoDarkUrl: string | null;
  sponsorName: string;
};

/** Dónde está parado el visitante. Lo que no aplique, se omite. */
export type SponsorContext = Partial<Record<SponsorScope, string>>;

export function pickSponsor(
  placements: SponsorPlacement[],
  slotCode: SponsorSlotCode,
  context: SponsorContext,
  random: () => number = Math.random,
): SponsorPlacement | null {
  for (const scope of SPONSOR_SCOPES) {
    const scopeId = context[scope];
    if (!scopeId) continue;

    const matches = placements.filter(
      (p) => p.slotCode === slotCode && p.scope === scope && p.scopeId === scopeId,
    );
    if (!matches.length) continue;

    // La prioridad manda sobre la rotación: es la forma de fijar uno a mano
    const top = Math.max(...matches.map((p) => p.priority));
    return rotate(matches.filter((p) => p.priority === top), random);
  }
  return null;
}

/** Elige una al azar, con el peso de cada una como probabilidad. */
function rotate(list: SponsorPlacement[], random: () => number): SponsorPlacement {
  if (list.length === 1) return list[0];
  const weight = (p: SponsorPlacement) => Math.max(1, p.rotationWeight);
  let point = random() * list.reduce((total, p) => total + weight(p), 0);
  for (const p of list) {
    point -= weight(p);
    if (point < 0) return p;
  }
  return list[list.length - 1];
}
