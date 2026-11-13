"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { check, parseForm, refreshPublic, runAdmin, type ActionState } from "@/features/admin/action";

/** Fecha y hora escritas en Panamá (UTC−5, sin horario de verano) → ISO. */
function panamaToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-05:00`).toISOString();
}

const matchSchema = z
  .object({
    date: z.iso.date("Fecha no válida"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida"),
    home_team_id: z.uuid("Elige el equipo local"),
    away_team_id: z.uuid("Elige el equipo visitante"),
    venue_id: z.union([z.uuid(), z.literal("")]),
    matchday: z.union([z.coerce.number().int().min(1).max(99), z.literal("")]),
  })
  .refine((m) => m.home_team_id !== m.away_team_id, { path: ["away_team_id"], message: "Debe ser distinto del local" });

function toRow(m: z.infer<typeof matchSchema>) {
  return {
    starts_at: panamaToIso(m.date, m.time),
    home_team_id: m.home_team_id,
    away_team_id: m.away_team_id,
    venue_id: m.venue_id || null,
    matchday: m.matchday === "" ? null : m.matchday,
  };
}

export async function createMatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(matchSchema.and(z.object({ season_id: z.uuid(), category_id: z.uuid() })), formData);
  if (parsed.errors) return parsed.errors;
  const { season_id, category_id } = parsed.data;
  return runAdmin(async (supabase) => {
    check(await supabase.from("matches").insert({ ...toRow(parsed.data), season_id, category_id }));
    refreshPublic("matches");
    return { ok: true, message: "Partido programado." };
  });
}

const updateSchema = matchSchema.and(
  z.object({
    id: z.uuid(),
    status: z.enum(["scheduled", "postponed", "cancelled", "finished"]),
    home_score: z.union([z.coerce.number().int().min(0).max(99), z.literal("")]),
    away_score: z.union([z.coerce.number().int().min(0).max(99), z.literal("")]),
    notes: z.string().trim().max(500).optional(),
  }),
);

export async function updateMatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(updateSchema, formData);
  if (parsed.errors) return parsed.errors;
  const m = parsed.data;
  const finished = m.status === "finished";
  if (finished && (m.home_score === "" || m.away_score === "")) {
    return { error: "Para marcarlo como finalizado escribe el resultado.", fieldErrors: { home_score: ["Requerido"] } };
  }
  return runAdmin(async (supabase) => {
    const current = check(await supabase.from("matches").select("status, finished_at").eq("id", m.id).single());
    if (current.status === "live" && m.status !== "finished") {
      return { error: "El partido está en vivo: lo controla el delegado desde el marcador." };
    }
    check(
      await supabase
        .from("matches")
        .update({
          ...toRow(m),
          status: m.status,
          home_score: finished ? Number(m.home_score) : null,
          away_score: finished ? Number(m.away_score) : null,
          finished_at: finished ? (current.finished_at ?? new Date().toISOString()) : null,
          notes: m.notes || null,
        })
        .eq("id", m.id),
    );
    refreshPublic("matches", `match-${m.id}`);
    return { ok: true, message: "Partido actualizado." };
  });
}

export async function deleteMatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id"));
  const back = String(formData.get("back") ?? "/admin/partidos");
  const result = await runAdmin(async (supabase) => {
    check(await supabase.from("matches").delete().eq("id", id));
    refreshPublic("matches");
  });
  if (result.error) return result;
  redirect(back.startsWith("/admin") ? back : "/admin/partidos");
}

export async function assignOfficial(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(
    z.object({ match_id: z.uuid(), user_id: z.uuid("Elige un delegado"), role: z.enum(["delegate", "referee"]) }),
    formData,
  );
  if (parsed.errors) return parsed.errors;
  return runAdmin(async (supabase) => {
    check(await supabase.from("match_officials").insert(parsed.data));
    return { ok: true, message: "Asignado." };
  });
}

export async function removeOfficial(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const matchId = String(formData.get("match_id"));
  const userId = String(formData.get("user_id"));
  return runAdmin(async (supabase) => {
    check(await supabase.from("match_officials").delete().eq("match_id", matchId).eq("user_id", userId));
    return { ok: true, message: "Quitado." };
  });
}
