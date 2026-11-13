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
