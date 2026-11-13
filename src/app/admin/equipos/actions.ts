"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { check, parseForm, refreshPublic, runAdmin, type ActionState } from "@/features/admin/action";
import { fileFrom, processImage } from "@/features/admin/images";
import type { TablesUpdate } from "@/types/database";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido");

const teamSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(60),
  short_name: z.string().trim().toUpperCase().min(2, "2 a 4 letras").max(4, "2 a 4 letras"),
  primary_color: hex,
  secondary_color: hex,
});

function slugify(text: string, suffix: string) {
  const base = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "equipo"}-${suffix.toLowerCase()}`;
}

export async function createTeam(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(
    teamSchema.extend({ season_id: z.uuid(), category_id: z.uuid(), category_code: z.string() }),
    formData,
  );
  if (parsed.errors) return parsed.errors;
  const { category_code, ...t } = parsed.data;
  return runAdmin(async (supabase) => {
    check(await supabase.from("teams").insert({ ...t, slug: slugify(t.name, category_code) }));
    refreshPublic("teams", "standings");
    return { ok: true, message: `Equipo ${t.name} creado.` };
  });
}

export async function updateTeam(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(teamSchema.extend({ id: z.uuid() }), formData);
  if (parsed.errors) return parsed.errors;
  const { id, ...t } = parsed.data;
  const logo = fileFrom(formData, "logo");
  return runAdmin(async (supabase) => {
    const update: TablesUpdate<"teams"> = { ...t };
    if (logo) {
      const image = await processImage(logo, { size: 512, fit: "inside" });
      const path = `${id}/${Date.now()}.webp`; // nombre nuevo: evita logos viejos en caché
      check(await supabase.storage.from("team-logos").upload(path, image, { contentType: "image/webp" }));
      update.logo_path = path;
    }
    check(await supabase.from("teams").update(update).eq("id", id));
    refreshPublic("teams", `team-${id}`, "matches", "standings");
    return { ok: true, message: "Equipo actualizado." };
  });
}

export async function deleteTeam(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id"));
  const back = String(formData.get("back") ?? "/admin/equipos");
  const result = await runAdmin(async (supabase) => {
    check(await supabase.from("teams").delete().eq("id", id));
    refreshPublic("teams", "standings");
  });
  if (result.error) return result;
  redirect(back.startsWith("/admin") ? back : "/admin/equipos");
}

// ---------------------------------------------------------------------------
// Jugadores
// ---------------------------------------------------------------------------
const playerSchema = z.object({
  first_name: z.string().trim().min(1, "Escribe el nombre").max(40),
  last_initial: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-ZÁÉÍÓÚÑÜ]$/, "Solo una letra (la inicial)"),
  jersey_number: z.coerce.number().int().min(0, "0 a 99").max(99, "0 a 99"),
  position: z.string().trim().max(30).optional(),
});

export async function addPlayer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(playerSchema.extend({ team_id: z.uuid(), season_id: z.uuid() }), formData);
  if (parsed.errors) return parsed.errors;
  const { team_id, season_id, jersey_number, position, ...player } = parsed.data;
  return runAdmin(async (supabase) => {
    const created = check(await supabase.from("players").insert(player).select("id").single());
    const { error } = await supabase
      .from("roster_entries")
      .insert({ team_id, season_id, player_id: created.id, jersey_number, position: position || null });
    if (error) {
      await supabase.from("players").delete().eq("id", created.id); // no dejar jugadores sueltos
      throw error;
    }
    refreshPublic("teams", `team-${team_id}`);
    return { ok: true, message: `${player.first_name} ${player.last_initial}. agregado al plantel.` };
  });
}

export async function updatePlayer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(playerSchema.extend({ player_id: z.uuid(), roster_id: z.uuid(), team_id: z.uuid() }), formData);
  if (parsed.errors) return parsed.errors;
  const { player_id, roster_id, team_id, jersey_number, position, ...player } = parsed.data;
  return runAdmin(async (supabase) => {
    check(await supabase.from("players").update(player).eq("id", player_id));
    check(await supabase.from("roster_entries").update({ jersey_number, position: position || null }).eq("id", roster_id));
    refreshPublic("teams", `team-${team_id}`, "matches");
    return { ok: true, message: "Datos del jugador actualizados." };
  });
}

/** Foto de perfil: se procesa en el servidor (sin EXIF/GPS) y va al bucket privado. */
export async function updatePlayerPhoto(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const playerId = String(formData.get("player_id"));
  const consent = formData.get("photo_consent") === "on";
  const photo = fileFrom(formData, "photo");
  const removePhoto = formData.get("remove_photo") === "on";
  return runAdmin(async (supabase) => {
    const current = check(await supabase.from("players").select("photo_path, photo_consent").eq("id", playerId).single());
    const update: { photo_consent?: boolean; photo_path?: string | null } = {};
    if (consent !== current.photo_consent) update.photo_consent = consent;

    if (photo) {
      const image = await processImage(photo, { size: 600, fit: "cover" });
      const path = `${playerId}/${Date.now()}.webp`;
      check(await supabase.storage.from("player-photos").upload(path, image, { contentType: "image/webp" }));
      update.photo_path = path;
    } else if (removePhoto) {
      update.photo_path = null;
    }

    if (Object.keys(update).length) check(await supabase.from("players").update(update).eq("id", playerId));
    if (current.photo_path && "photo_path" in update) {
      await supabase.storage.from("player-photos").remove([current.photo_path]);
    }
    refreshPublic("teams", "matches");
    return { ok: true, message: "Foto y consentimiento guardados." };
  });
}

export async function removeFromRoster(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rosterId = String(formData.get("roster_id"));
  const teamId = String(formData.get("team_id"));
  const result = await runAdmin(async (supabase) => {
    check(await supabase.from("roster_entries").delete().eq("id", rosterId));
    refreshPublic("teams", `team-${teamId}`);
  });
  if (result.error) return result;
  redirect(`/admin/equipos/${teamId}`);
}

/** Borra al jugador y TODOS sus datos (derecho de supresión). Irreversible. */
export async function deletePlayer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const playerId = String(formData.get("player_id"));
  const teamId = String(formData.get("team_id"));
  if (formData.get("confirm_name") !== formData.get("expected_name")) {
    return { error: "Escribe el nombre exactamente como aparece para confirmar.", fieldErrors: { confirm_name: ["No coincide"] } };
  }
  const result = await runAdmin(async (supabase) => {
    const player = check(await supabase.from("players").select("photo_path").eq("id", playerId).single());
    check(await supabase.from("players").delete().eq("id", playerId));
    if (player.photo_path) await supabase.storage.from("player-photos").remove([player.photo_path]);
    refreshPublic("teams", `team-${teamId}`, "matches");
  });
  if (result.error) return result;
  redirect(teamId ? `/admin/equipos/${teamId}` : "/admin/equipos");
}
