/**
 * Reglas que debe cumplir una crónica antes de guardarse como borrador.
 *
 * Archivo neutro (sin "server-only" ni "use client"): lo usan el generador en
 * servidor y las pruebas. No depende de Supabase ni de la API de Claude.
 *
 * POR QUÉ ESTO EXISTE: el prompt ya le pide al modelo que use solo "nombre +
 * inicial", pero pedirlo no es garantizarlo. Estas comprobaciones son la
 * garantía. Si alguna falla, la crónica NO se guarda.
 */

export const MIN_WORDS = 80;
export const MAX_WORDS = 120;

export type ChronicleIssue =
  | { code: "word_count"; words: number }
  | { code: "surname"; firstName: string; found: string }
  | { code: "unknown_player"; found: string };

/** Palabras reales, ignorando espacios y saltos de línea. */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** "Carlos M." → { firstName: "Carlos", initial: "M" } */
function splitDisplayName(displayName: string) {
  const match = displayName.trim().match(/^(.+?)\s+(\p{Lu})\.?$/u);
  return match ? { firstName: match[1], initial: match[2] } : null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Comprueba una crónica contra los nombres que se le pasaron al modelo.
 *
 * `allowedNames` son los `display_name` de `public_players` ("Carlos M."), los
 * únicos nombres de menores que pueden aparecer. Se detectan dos fallos:
 *
 *  1. **Apellido inventado**: un nombre que sí enviamos aparece seguido de algo
 *     que no es su inicial ("Carlos Méndez" en vez de "Carlos M."). Es el riesgo
 *     real, porque el modelo nunca recibió apellidos y tendría que inventarlos.
 *  2. **Jugador inventado**: aparece un "Nombre I." que no está en la lista.
 *
 * No se intenta detectar cualquier par de palabras con mayúscula: daría falsos
 * positivos con equipos, canchas y meses, y un nombre completamente inventado no
 * expone a ningún niño real — eso lo corrige el admin al revisar.
 */
export function checkChronicle(text: string, allowedNames: string[]): ChronicleIssue[] {
  const issues: ChronicleIssue[] = [];

  const words = countWords(text);
  if (words < MIN_WORDS || words > MAX_WORDS) issues.push({ code: "word_count", words });

  // Un mismo nombre puede tener varias iniciales válidas (dos "Carlos" distintos)
  const initialsByFirstName = new Map<string, Set<string>>();
  const allowed = new Set<string>();
  for (const name of allowedNames) {
    const parts = splitDisplayName(name);
    if (!parts) continue;
    allowed.add(`${parts.firstName} ${parts.initial}.`);
    const set = initialsByFirstName.get(parts.firstName) ?? new Set<string>();
    set.add(parts.initial);
    initialsByFirstName.set(parts.firstName, set);
  }

  // 1. Si a un nombre nuestro le sigue OTRA PALABRA CON MAYÚSCULA, esa palabra
  //    tiene que ser su inicial. Se exige la mayúscula para no confundir un
  //    verbo con un apellido: "Carlos marcó" es correcto, "Carlos Méndez" no.
  for (const [firstName, initials] of initialsByFirstName) {
    const re = new RegExp(`\\b${escapeRe(firstName)}\\b(?:\\s+(\\p{Lu}\\p{L}*)\\.?)?`, "gu");
    for (const match of text.matchAll(re)) {
      const next = match[1];
      if (next && !initials.has(next)) {
        issues.push({ code: "surname", firstName, found: `${firstName} ${next}` });
      }
    }
  }

  // 2. Todo "Nombre I." del texto es uno de los jugadores que enviamos
  for (const match of text.matchAll(/\b(\p{Lu}\p{L}+)\s+(\p{Lu})\.(?!\p{L})/gu)) {
    const found = `${match[1]} ${match[2]}.`;
    if (!allowed.has(found)) issues.push({ code: "unknown_player", found });
  }

  return issues;
}

/** Mensaje en español para el panel y los registros. */
export function describeIssue(issue: ChronicleIssue): string {
  switch (issue.code) {
    case "word_count":
      return `La crónica tiene ${issue.words} palabras; deben ser entre ${MIN_WORDS} y ${MAX_WORDS}.`;
    case "surname":
      return `Aparece “${issue.found}”: a ${issue.firstName} solo puede seguirle su inicial.`;
    case "unknown_player":
      return `Aparece “${issue.found}”, que no es ninguno de los jugadores del partido.`;
  }
}
