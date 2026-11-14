"use server";

import { z } from "zod";
import { check, parseForm, refreshPublic, runAdmin, type ActionState } from "@/features/admin/action";

export async function setRecognitionMode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(
    z.object({ id: z.uuid(), recognition_mode: z.enum(["team_stars", "individual_ranking"]) }),
    formData,
  );
  if (parsed.errors) return parsed.errors;
  const { id, recognition_mode } = parsed.data;
  return runAdmin(async (supabase) => {
    check(await supabase.from("categories").update({ recognition_mode }).eq("id", id));
    // El modo cambia líderes, estadísticas, nombres en partidos y certificados.
    refreshPublic("categories", "matches", "leaders", "recognitions", "standings");
    return { ok: true, message: "Modo actualizado." };
  });
}

export async function setLeagueMvp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(
    z.object({
      id: z.uuid(),
      mvp_mode: z.enum(["official", "parent_vote"]),
      mvp_vote_hours: z.coerce.number().int().min(1, "De 1 a 72 horas").max(72, "De 1 a 72 horas"),
    }),
    formData,
  );
  if (parsed.errors) return parsed.errors;
  const { id, ...settings } = parsed.data;
  return runAdmin(async (supabase) => {
    check(await supabase.from("leagues").update(settings).eq("id", id));
    refreshPublic("matches");
    return { ok: true, message: "Guardado." };
  });
}
