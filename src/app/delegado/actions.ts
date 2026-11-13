"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type LiveResult = { ok: true } | { ok: false; error: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Envoltorio de las acciones del marcador: delegado o admin. La BD (RLS y RPC)
 * impone que el delegado solo cargue los partidos que tiene asignados y solo
 * mientras el partido está en vivo o hasta 1 h después de terminar.
 */
async function runLive(matchId: string, fn: (supabase: Supabase) => Promise<void>): Promise<LiveResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "delegate" && user.role !== "admin")) return { ok: false, error: "No autorizado." };
  if (!z.uuid().safeParse(matchId).success) return { ok: false, error: "Partido no válido." };
  try {
    await fn(await createClient());
    // El público ve el cambio al instante (Realtime + recarga con caché fresca).
    updateTag("matches");
    updateTag(`match-${matchId}`);
    return { ok: true };
  } catch (error) {
    const e = error as { code?: string; message?: string };
    if (e.code === "42501") return { ok: false, error: "No tienes permiso: este partido no está asignado a ti o ya no se puede editar." };
    return { ok: false, error: e.message ?? "No se pudo guardar. Revisa la conexión e inténtalo de nuevo." };
  }
}

function must<T>(r: { data: T; error: { message: string; code?: string } | null }): NonNullable<T> {
  if (r.error) throw r.error;
  return r.data as NonNullable<T>;
}

export async function startMatch(matchId: string) {
  return runLive(matchId, async (supabase) => {
    must(await supabase.rpc("start_match", { p_match_id: matchId }));
  });
}

export async function finishMatch(matchId: string) {
  return runLive(matchId, async (supabase) => {
    must(await supabase.rpc("finish_match", { p_match_id: matchId }));
  });
}

const eventSchema = z.object({
  matchId: z.uuid(),
  teamId: z.uuid(),
  playerId: z.uuid(),
  code: z.enum(["goal", "own_goal", "save", "fair_play", "yellow_card", "red_card"]),
  minute: z.number().int().min(0).max(150).nullable(),
  assistPlayerId: z.uuid().nullable().optional(),
});

/** Carga un evento (y la asistencia del gol, si la hubo). */
export async function addEvent(input: z.infer<typeof eventSchema>) {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos del evento no válidos." } as LiveResult;
  const e = parsed.data;
  return runLive(e.matchId, async (supabase) => {
    const types = must(await supabase.from("event_types").select("id, code").in("code", [e.code, "assist"]));
    const typeId = (code: string) => {
      const t = types.find((x) => x.code === code);
      if (!t) throw new Error(`Tipo de evento desconocido: ${code}`);
      return t.id;
    };
    const rows = [{ match_id: e.matchId, team_id: e.teamId, player_id: e.playerId, event_type_id: typeId(e.code), minute: e.minute }];
    if (e.code === "goal" && e.assistPlayerId && e.assistPlayerId !== e.playerId) {
      rows.push({ match_id: e.matchId, team_id: e.teamId, player_id: e.assistPlayerId, event_type_id: typeId("assist"), minute: e.minute });
    }
    must(await supabase.from("match_events").insert(rows));
  });
}

/** Anula (no borra) un evento cargado por error. Se puede deshacer. */
export async function setEventVoided(matchId: string, eventId: string, voided: boolean) {
  if (!z.uuid().safeParse(eventId).success) return { ok: false, error: "Evento no válido." } as LiveResult;
  return runLive(matchId, async (supabase) => {
    const updated = must(
      await supabase
        .from("match_events")
        .update({ voided_at: voided ? new Date().toISOString() : null })
        .eq("id", eventId)
        .eq("match_id", matchId)
        .select("id"),
    );
    if (!updated.length) throw Object.assign(new Error("No autorizado"), { code: "42501" });
  });
}

/** Marca a un jugador como presente o ausente. */
export async function setAttendance(matchId: string, teamId: string, playerId: string, present: boolean) {
  if (!z.uuid().safeParse(playerId).success || !z.uuid().safeParse(teamId).success) {
    return { ok: false, error: "Jugador no válido." } as LiveResult;
  }
  return runLive(matchId, async (supabase) => {
    if (present) {
      must(await supabase.from("match_attendance").upsert({ match_id: matchId, team_id: teamId, player_id: playerId }));
    } else {
      must(await supabase.from("match_attendance").delete().eq("match_id", matchId).eq("player_id", playerId));
    }
  });
}

export async function chooseMvp(matchId: string, playerId: string) {
  if (!z.uuid().safeParse(playerId).success) return { ok: false, error: "Jugador no válido." } as LiveResult;
  return runLive(matchId, async (supabase) => {
    must(await supabase.rpc("set_match_mvp", { p_match_id: matchId, p_player_id: playerId }));
  });
}
