"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FamilyResult = { ok: true; message?: string } | { ok: false; error: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Acciones de la cuenta de familia: requieren sesión; la BD (RLS/RPC) decide el resto. */
async function runFamily(fn: (supabase: Supabase, userId: string) => Promise<FamilyResult | void>): Promise<FamilyResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Ingresa con tu cuenta para continuar." };
  try {
    return (await fn(await createClient(), user.id)) ?? { ok: true };
  } catch (error) {
    const e = error as { code?: string; message?: string };
    if (e.code === "42501") return { ok: false, error: e.message && e.message !== "No autorizado" ? e.message : "No tienes permiso para esto." };
    return { ok: false, error: e.message ?? "No se pudo guardar. Inténtalo de nuevo." };
  }
}

const uuid = z.uuid();

/** Padre/madre da o retira el consentimiento para mostrar la foto de su hijo. */
export async function setPhotoConsent(playerId: string, consent: boolean) {
  if (!uuid.safeParse(playerId).success) return { ok: false, error: "Jugador no válido." } as FamilyResult;
  return runFamily(async (supabase) => {
    const { error } = await supabase.rpc("set_photo_consent", { p_player_id: playerId, p_consent: consent });
    if (error) throw error;
    updateTag("teams");
    updateTag("matches");
    return { ok: true, message: consent ? "Consentimiento dado: la foto se puede mostrar." : "Consentimiento retirado: la foto ya no se muestra." };
  });
}

export async function setFollow(teamId: string, follow: boolean) {
  if (!uuid.safeParse(teamId).success) return { ok: false, error: "Equipo no válido." } as FamilyResult;
  return runFamily(async (supabase, userId) => {
    const { error } = follow
      ? await supabase.from("team_follows").upsert({ user_id: userId, team_id: teamId })
      : await supabase.from("team_follows").delete().eq("user_id", userId).eq("team_id", teamId);
    if (error) throw error;
  });
}

/** Voto MVP: un voto por familia y partido; nunca por un hijo propio (lo impone la BD). */
export async function voteMvp(matchId: string, playerId: string) {
  if (!uuid.safeParse(matchId).success || !uuid.safeParse(playerId).success) {
    return { ok: false, error: "Datos no válidos." } as FamilyResult;
  }
  return runFamily(async (supabase) => {
    const { error } = await supabase.rpc("cast_mvp_vote", { p_match_id: matchId, p_player_id: playerId });
    if (error) throw Object.assign(new Error(error.message), { code: error.code === "42501" ? "42501" : "P0001" });
    return { ok: true, message: "¡Gracias! El voto de tu familia quedó registrado." };
  });
}
