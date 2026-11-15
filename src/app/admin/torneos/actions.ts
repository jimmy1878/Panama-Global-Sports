"use server";

import { z } from "zod";
import { check, parseForm, refreshPublic, runAdmin, type ActionState } from "@/features/admin/action";

/**
 * Un torneo es liga × circuito × tipo × año. La base impone que la combinación
 * exista (la Copa de Navidad solo en Academias) y que no se repita en el año.
 * Pueden estar varios en curso a la vez: eso no se bloquea a propósito.
 */
const tournamentSchema = z
  .object({
    league_id: z.uuid("Elige una liga"),
    circuit_id: z.uuid("Elige un circuito"),
    tournament_type_id: z.uuid("Elige un tipo de torneo"),
    year: z.coerce.number().int().min(2020, "Año no válido").max(2100, "Año no válido"),
    starts_on: z.iso.date("Fecha no válida"),
    ends_on: z.iso.date("Fecha no válida"),
  })
  .refine((t) => t.ends_on > t.starts_on, { path: ["ends_on"], message: "Debe ser después del inicio" });

const STATUSES = ["proximo", "inscripciones", "en_curso", "finalizado"] as const;

export async function createTournament(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(tournamentSchema, formData);
  if (parsed.errors) return parsed.errors;
  const t = parsed.data;

  return runAdmin(async (supabase) => {
    // El nombre y el slug salen del circuito y del tipo: "Academias · Clausura 2026"
    const [{ data: circuit }, { data: type }] = await Promise.all([
      supabase.from("circuits").select("slug, name").eq("id", t.circuit_id).maybeSingle(),
      supabase.from("tournament_types").select("slug, name").eq("id", t.tournament_type_id).maybeSingle(),
    ]);
    if (!circuit || !type) return { ok: false, message: "Circuito o tipo de torneo no encontrado." };

    check(
      await supabase.from("tournaments").insert({
        ...t,
        slug: `${circuit.slug}-${type.slug}-${t.year}`,
        name: `${circuit.name} · ${type.name} ${t.year}`,
      }),
    );
    refreshPublic("tournaments", "teams", "matches");
    return { ok: true, message: "Torneo creado." };
  });
}

export async function setTournamentStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return { ok: false, message: "Estado no válido." };
  }

  return runAdmin(async (supabase) => {
    check(
      await supabase.rpc("admin_set_tournament_status", {
        p_tournament_id: id,
        p_status: status as (typeof STATUSES)[number],
      }),
    );
    refreshPublic("tournaments", "teams", "matches");
    return { ok: true, message: "Estado del torneo actualizado." };
  });
}
