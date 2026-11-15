"use server";

import { z } from "zod";
import { check, parseForm, refreshPublic, runAdmin, type ActionState } from "@/features/admin/action";

/**
 * Revisión de la galería. Nada se ve hasta que un admin aprueba.
 *
 * El bloqueo por consentimiento no se comprueba aquí: lo impone un trigger de
 * la base (`guard_media_status`), que rechaza aprobar si en la foto aparece un
 * niño sin permiso de foto que no haya sido recortado. Este archivo solo
 * traduce ese error al español.
 */

const mediaSchema = z.object({ media_id: z.uuid() });

export async function approveMedia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(mediaSchema, formData);
  if (parsed.errors) return parsed.errors;
  return runAdmin(async (supabase) => {
    check(await supabase.from("media_items").update({ status: "approved" }).eq("id", parsed.data.media_id));
    refreshPublic("matches");
    return { ok: true, message: "Foto aprobada: ya la ven las familias de la liga." };
  });
}

export async function rejectMedia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(
    mediaSchema.extend({ reason: z.string().trim().max(200).optional() }),
    formData,
  );
  if (parsed.errors) return parsed.errors;
  return runAdmin(async (supabase) => {
    check(
      await supabase
        .from("media_items")
        .update({ status: "rejected", rejection_reason: parsed.data.reason || "No cumple las normas de la liga." })
        .eq("id", parsed.data.media_id),
    );
    refreshPublic("matches");
    return { ok: true, message: "Foto rechazada." };
  });
}

/**
 * Marca que un niño sin consentimiento ya fue recortado o difuminado en la
 * foto. Es una afirmación del admin sobre una edición que hizo él: la base
 * confía en ella para dejar aprobar.
 */
export async function setTagRedacted(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(
    mediaSchema.extend({ player_id: z.uuid(), redacted: z.enum(["0", "1"]) }),
    formData,
  );
  if (parsed.errors) return parsed.errors;
  const { media_id, player_id, redacted } = parsed.data;

  return runAdmin(async (supabase) => {
    check(
      await supabase
        .from("media_tags")
        .update({ redacted: redacted === "1" })
        .eq("media_id", media_id)
        .eq("player_id", player_id),
    );
    refreshPublic("matches");
    return {
      ok: true,
      message: redacted === "1" ? "Marcado como recortado." : "Ya no está marcado como recortado.",
    };
  });
}

export async function deleteMedia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(mediaSchema, formData);
  if (parsed.errors) return parsed.errors;
  return runAdmin(async (supabase) => {
    check(await supabase.from("media_items").delete().eq("id", parsed.data.media_id));
    refreshPublic("matches");
    return { ok: true, message: "Foto eliminada." };
  });
}
