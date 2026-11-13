"use server";

import { z } from "zod";
import { check, parseForm, refreshPublic, runAdmin, type ActionState } from "@/features/admin/action";

const seasonSchema = z
  .object({
    year: z.coerce.number().int().min(2020, "Año no válido").max(2100, "Año no válido"),
    number: z.coerce.number().int().min(1, "Del 1 al 5").max(5, "Del 1 al 5"),
    starts_on: z.iso.date("Fecha no válida"),
    ends_on: z.iso.date("Fecha no válida"),
  })
  .refine((s) => s.ends_on > s.starts_on, { path: ["ends_on"], message: "Debe ser después del inicio" });

export async function createSeason(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(seasonSchema, formData);
  if (parsed.errors) return parsed.errors;
  const s = parsed.data;
  return runAdmin(async (supabase) => {
    check(await supabase.from("seasons").insert({ ...s, name: `Temporada ${s.number} · ${s.year}` }));
    refreshPublic("seasons");
    return { ok: true, message: "Temporada creada." };
  });
}

export async function setCurrentSeason(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id"));
  return runAdmin(async (supabase) => {
    check(await supabase.rpc("admin_set_current_season", { p_season_id: id }));
    refreshPublic("seasons", "teams", "matches");
    return { ok: true, message: "Ahora es la temporada actual." };
  });
}

export async function toggleSeasonClosed(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id"));
  const close = formData.get("close") === "1";
  return runAdmin(async (supabase) => {
    check(await supabase.from("seasons").update({ closed_at: close ? new Date().toISOString() : null }).eq("id", id));
    refreshPublic("seasons");
    return { ok: true, message: close ? "Temporada cerrada: ya se pueden descargar los certificados." : "Temporada reabierta." };
  });
}
