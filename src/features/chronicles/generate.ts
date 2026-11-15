import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getMatchDetail } from "@/features/league/data";
import { createServiceClient } from "@/lib/supabase/admin";
import { checkChronicle, describeIssue, MAX_WORDS, MIN_WORDS, type ChronicleIssue } from "./rules";

/**
 * Genera la crónica de un partido con la API de Claude y la guarda como
 * BORRADOR. Nunca publica: eso lo hace un administrador desde el panel.
 *
 * PRIVACIDAD: al modelo solo le llegan nombres con inicial (`public_players`),
 * nombres de equipo, marcador, minutos y tipo de evento. Nunca apellidos
 * completos, fechas de nacimiento, colegio ni contacto. Antes de guardar, el
 * texto pasa por `checkChronicle`: si no cumple, no se guarda nada.
 */

const MODEL = "claude-opus-5-5";
const PROMPT_VERSION = "2026-11-15";

const SYSTEM = `Eres el cronista de Panama Global Sports, una liga de fútbol infantil en Panamá.
Escribes crónicas cortas de partidos de niños y niñas para que las lean sus familias.

Reglas que no puedes romper:
- Escribe en español de Panamá, entre ${MIN_WORDS} y ${MAX_WORDS} palabras, en un solo párrafo.
- Tono siempre positivo y celebratorio. Es fútbol infantil: lo que importa es que jugaron.
- NUNCA menciones un error, un fallo ni nada que pueda avergonzar a un niño. No existen los
  penales fallados, los autogoles desafortunados ni las malas actuaciones.
- No critiques ni compares a ningún jugador con otro.
- A los jugadores los nombras EXACTAMENTE como aparecen en los datos: nombre y su inicial, por
  ejemplo "Carlos M.". Nunca inventes un apellido ni completes la inicial. Nunca menciones a un
  jugador que no esté en los datos.
- No inventes hechos: usa solo lo que está en los datos del partido.
- Escribe el texto de la crónica y nada más: sin título, sin comillas, sin encabezados.`;

const EVENT_LABEL: Record<string, string> = {
  goal: "gol",
  own_goal: "gol en propia puerta (cuenta para el rival)",
  assist: "asistencia",
  fair_play: "gesto de fair play",
  yellow_card: "tarjeta amarilla",
  red_card: "tarjeta roja",
};

type MatchFacts = { prompt: string; allowedNames: string[] };

/** Arma los hechos del partido en texto plano, solo con datos públicos. */
function buildFacts(detail: NonNullable<Awaited<ReturnType<typeof getMatchDetail>>>): MatchFacts {
  const { match, category, timeline, mvpByTeam } = detail;
  const individual = category?.recognitionMode === "individual_ranking";
  const allowedNames = new Set<string>();

  const lines: string[] = [
    `Competición: ${category?.leagueName ?? "Panama Global Sports"} · ${category?.code ?? ""}`,
    `Equipo local: ${match.home.name} — ${match.homeScore ?? 0} goles`,
    `Equipo visitante: ${match.away.name} — ${match.awayScore ?? 0} goles`,
  ];
  if (match.venue) lines.push(`Cancha: ${match.venue}`);

  lines.push("", "Lo que pasó en el partido:");
  if (timeline.length === 0) {
    lines.push("- No se registraron jugadas concretas.");
  }
  for (const event of timeline) {
    const team = event.teamId === match.home.id ? match.home.name : match.away.name;
    const label = EVENT_LABEL[event.code] ?? event.code;
    const minute = event.minute != null ? `minuto ${event.minute}` : "sin minuto";
    if (event.playerName) allowedNames.add(event.playerName);
    // En categorías sin ranking individual el evento va sin nombre, a propósito
    const who = event.playerName ? `${event.playerName} (${team})` : team;
    lines.push(`- ${minute}: ${label} — ${who}`);
  }

  const mvps = Object.entries(mvpByTeam).filter(([, name]) => name);
  if (mvps.length) {
    lines.push("", "Jugador del partido:");
    for (const [teamId, name] of mvps) {
      const team = teamId === match.home.id ? match.home.name : match.away.name;
      if (name) allowedNames.add(name);
      lines.push(`- ${name} (${team})`);
    }
  }

  if (!individual) {
    lines.push(
      "",
      "IMPORTANTE: en esta categoría NO se destaca a ningún jugador por su nombre. Escribe la " +
        "crónica centrada en los dos equipos y en cómo jugaron juntos. La única excepción es el " +
        "jugador del partido, si aparece arriba.",
    );
  }

  return { prompt: lines.join("\n"), allowedNames: [...allowedNames] };
}

function textOf(response: Anthropic.Beta.BetaMessage): string {
  return response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/**
 * Una llamada al modelo. Se pide con `fallbacks`, que hace que si un
 * clasificador de seguridad rechaza la petición la atienda otro modelo en la
 * misma llamada, en vez de dejar el partido sin crónica. Si la cuenta todavía
 * no tiene esa opción, se repite la llamada sin ella en vez de fallar.
 */
async function ask(client: Anthropic, messages: Anthropic.Beta.BetaMessageParam[]) {
  const base = {
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages,
    output_config: { effort: "low" as const },
  };
  try {
    return await client.beta.messages.create({
      ...base,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (error) {
    if (!(error instanceof Anthropic.BadRequestError)) throw error;
    console.warn("Crónica: la cuenta no admite fallbacks; se pide sin ellos.", error.message);
    return await client.beta.messages.create(base);
  }
}

export type GenerateResult =
  | { ok: true; body: string }
  | { ok: false; reason: string; issues?: ChronicleIssue[] };

/**
 * Genera y guarda el borrador. Si ya existe una crónica para ese partido no la
 * toca: puede tener ediciones del admin o estar publicada.
 */
export async function generateChronicle(matchId: string): Promise<GenerateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, reason: "Falta ANTHROPIC_API_KEY." };

  const supabase = createServiceClient();
  if (!supabase) return { ok: false, reason: "Falta la clave de servicio de Supabase." };

  const { data: existing } = await supabase
    .from("match_chronicles")
    .select("match_id")
    .eq("match_id", matchId)
    .maybeSingle();
  if (existing) return { ok: false, reason: "Ese partido ya tiene crónica." };

  const detail = await getMatchDetail(matchId);
  if (!detail) return { ok: false, reason: "Partido no encontrado." };
  if (detail.match.status !== "finished") return { ok: false, reason: "El partido no ha terminado." };

  const facts = buildFacts(detail);
  const client = new Anthropic({ apiKey });

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `Datos del partido:\n\n${facts.prompt}\n\nEscribe la crónica.` },
  ];

  // Un reintento: si el texto incumple una regla, se le dice cuál y vuelve a escribir.
  let lastIssues: ChronicleIssue[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ask(client, messages);

    if (response.stop_reason === "refusal") {
      return { ok: false, reason: "El modelo declinó escribir esta crónica." };
    }

    const body = textOf(response);
    const issues = checkChronicle(body, facts.allowedNames);
    if (issues.length === 0) {
      const { error } = await supabase.from("match_chronicles").insert({
        match_id: matchId,
        status: "draft",
        body,
        generated_body: body,
        model: response.model,
        prompt_version: PROMPT_VERSION,
        generated_at: new Date().toISOString(),
      });
      if (error) return { ok: false, reason: `No se pudo guardar: ${error.message}` };
      return { ok: true, body };
    }

    lastIssues = issues;
    messages.push(
      { role: "assistant", content: body },
      {
        role: "user",
        content:
          "Esa versión no se puede publicar:\n" +
          issues.map((i) => `- ${describeIssue(i)}`).join("\n") +
          "\n\nEscríbela de nuevo corrigiendo eso. Solo el texto de la crónica.",
      },
    );
  }

  return { ok: false, reason: "La crónica no cumplió las reglas tras dos intentos.", issues: lastIssues };
}
