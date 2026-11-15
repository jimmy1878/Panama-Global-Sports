"use server";

import { z } from "zod";
import { check, parseForm, refreshPublic, runAdmin, type ActionState } from "@/features/admin/action";
import { generateChronicle } from "@/features/chronicles/generate";
import { checkChronicle, describeIssue } from "@/features/chronicles/rules";

/**
 * Revisión de crónicas. Nada se publica solo: el admin lee el borrador, lo
 * corrige si quiere y lo publica. Al publicar se vuelven a aplicar las reglas,
 * porque el texto pudo haberse editado a mano.
 */

const editSchema = z.object({
  match_id: z.uuid(),
  body: z.string().trim().min(1, "La crónica no puede quedar vacía").max(2000),
});

/** Nombres que pueden aparecer: los jugadores con evento o MVP en ese partido. */
async function allowedNames(
  supabase: Parameters<Parameters<typeof runAdmin>[0]>[0],
  matchId: string,
): Promise<string[]> {
  const [events, mvps] = await Promise.all([
    supabase.from("match_events").select("player_id").eq("match_id", matchId).is("voided_at", null),
    supabase.from("match_mvps").select("player_id").eq("match_id", matchId),
  ]);
  const ids = [...new Set([...(events.data ?? []), ...(mvps.data ?? [])].map((r) => r.player_id))];
  if (!ids.length) return [];
  const { data } = await supabase.from("public_players").select("display_name").in("id", ids);
  return (data ?? []).flatMap((p) => (p.display_name ? [p.display_name] : []));
}

export async function saveChronicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(editSchema, formData);
  if (parsed.errors) return parsed.errors;
  const { match_id, body } = parsed.data;

  return runAdmin(async (supabase) => {
    check(await supabase.from("match_chronicles").update({ body }).eq("match_id", match_id));
    refreshPublic("matches", `match-${match_id}`);
    return { ok: true, message: "Cambios guardados." };
  });
}

export async function publishChronicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(editSchema, formData);
  if (parsed.errors) return parsed.errors;
  const { match_id, body } = parsed.data;

  return runAdmin(async (supabase) => {
    // Se revalida: el admin pudo haber escrito un apellido completo al editar
    const issues = checkChronicle(body, await allowedNames(supabase, match_id));
    if (issues.length) {
      return {
        error: "No se puede publicar todavía.",
        fieldErrors: { body: issues.map(describeIssue) },
      };
    }
    check(
      await supabase.from("match_chronicles").update({ body, status: "published" }).eq("match_id", match_id),
    );
    refreshPublic("matches", `match-${match_id}`);
    return { ok: true, message: "Crónica publicada." };
  });
}

export async function unpublishChronicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const matchId = String(formData.get("match_id"));
  return runAdmin(async (supabase) => {
    check(await supabase.from("match_chronicles").update({ status: "draft" }).eq("match_id", matchId));
    refreshPublic("matches", `match-${matchId}`);
    return { ok: true, message: "Crónica retirada: vuelve a ser borrador." };
  });
}

export async function discardChronicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const matchId = String(formData.get("match_id"));
  return runAdmin(async (supabase) => {
    check(await supabase.from("match_chronicles").delete().eq("match_id", matchId));
    refreshPublic("matches", `match-${matchId}`);
    return { ok: true, message: "Borrador descartado. Puedes pedir uno nuevo." };
  });
}

/** Pide la crónica a la API (para partidos antiguos o si la automática falló). */
export async function requestChronicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const matchId = String(formData.get("match_id"));
  return runAdmin(async () => {
    const result = await generateChronicle(matchId);
    if (!result.ok) {
      const detail = result.issues?.length ? ` ${result.issues.map(describeIssue).join(" ")}` : "";
      return { error: `${result.reason}${detail}` };
    }
    refreshPublic("matches", `match-${matchId}`);
    return { ok: true, message: "Borrador generado. Revísalo antes de publicar." };
  });
}
