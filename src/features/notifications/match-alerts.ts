import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { followersOf, notifyUsers } from "./send";

const TZ = "America/Panama";
const timeFmt = new Intl.DateTimeFormat("es-PA", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("es-PA", { timeZone: TZ, weekday: "long" });

const MATCH_SELECT = `id, starts_at, status, home_score, away_score, home_team_id, away_team_id,
  category:categories(code),
  venue:venues(name),
  home:teams!matches_home_team_fkey(name),
  away:teams!matches_away_team_fkey(name)`;

/**
 * "Final: Tigres 3 – 1 Leones" a quienes siguen a cualquiera de los dos equipos.
 * Solo nombres de equipos: nunca datos de niños en las notificaciones.
 */
export async function sendFinalResult(matchId: string) {
  const supabase = createServiceClient();
  if (!supabase) return;
  const { data: m, error } = await supabase.from("matches").select(MATCH_SELECT).eq("id", matchId).maybeSingle();
  if (error) throw error;
  if (!m || m.status !== "finished" || m.home_score === null || m.away_score === null) return;

  const users = await followersOf([m.home_team_id, m.away_team_id]);
  await notifyUsers({
    userIds: users,
    kind: "final_result",
    matchId,
    payload: {
      title: `Final: ${m.home.name} ${m.home_score} – ${m.away_score} ${m.away.name}`,
      body: `${m.category?.code ?? ""} · Toca para ver los goles y el jugador del partido.`.trim(),
      url: `/partidos/${matchId}`,
      tag: `final-${matchId}`,
    },
  });
}

/**
 * Recordatorio de los partidos de MAÑANA (día en Panamá).
 * "Tu equipo juega mañana 9:00 en Cancha 2". Un aviso por usuario y partido.
 */
export async function sendTomorrowReminders(now = new Date()) {
  const supabase = createServiceClient();
  if (!supabase) return { matches: 0, sent: 0 };

  // Mañana en Panamá (UTC−5, sin horario de verano): [00:00, 24:00) hora local.
  const panamaNow = new Date(now.getTime() - 5 * 3600_000);
  const start = new Date(Date.UTC(panamaNow.getUTCFullYear(), panamaNow.getUTCMonth(), panamaNow.getUTCDate() + 1, 5));
  const end = new Date(start.getTime() + 24 * 3600_000);

  const { data: matches, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("status", "scheduled")
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString());
  if (error) throw error;

  let sent = 0;
  for (const m of matches) {
    const when = timeFmt.format(new Date(m.starts_at));
    const where = m.venue?.name ? ` en ${m.venue.name}` : "";
    // Un mensaje por equipo seguido (el texto dice cuál es "tu" equipo).
    for (const [teamId, team, rival] of [
      [m.home_team_id, m.home.name, m.away.name],
      [m.away_team_id, m.away.name, m.home.name],
    ] as const) {
      const users = await followersOf([teamId]);
      const result = await notifyUsers({
        userIds: users,
        kind: "match_reminder",
        matchId: m.id,
        payload: {
          title: `${team} juega mañana ${when}`,
          body: `${dayFmt.format(new Date(m.starts_at))} vs ${rival}${where} · ${m.category?.code ?? ""}`.trim(),
          url: `/partidos/${m.id}`,
          tag: `recordatorio-${m.id}`,
        },
      });
      sent += result.sent;
    }
  }
  return { matches: matches.length, sent };
}
