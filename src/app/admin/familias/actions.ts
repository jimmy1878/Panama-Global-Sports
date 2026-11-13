"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { check, parseForm, runAdmin, type ActionState } from "@/features/admin/action";

export async function createFamily(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(z.object({ name: z.string().trim().min(2, "Escribe un nombre").max(80) }), formData);
  if (parsed.errors) return parsed.errors;
  let familyId = "";
  const result = await runAdmin(async (supabase) => {
    familyId = check(await supabase.from("families").insert(parsed.data).select("id").single()).id;
  });
  if (result.error) return result;
  redirect(`/admin/familias/${familyId}`);
}

export async function renameFamily(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(z.object({ id: z.uuid(), name: z.string().trim().min(2, "Escribe un nombre").max(80) }), formData);
  if (parsed.errors) return parsed.errors;
  return runAdmin(async (supabase) => {
    check(await supabase.from("families").update({ name: parsed.data.name }).eq("id", parsed.data.id));
  });
}

export async function deleteFamily(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id"));
  const result = await runAdmin(async (supabase) => {
    check(await supabase.from("families").delete().eq("id", id));
  });
  if (result.error) return result;
  redirect("/admin/familias");
}

/** Vincula una cuenta (por su correo) a la familia. La persona debe haber ingresado al menos una vez. */
export async function addMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(
    z.object({
      family_id: z.uuid(),
      email: z.email("Correo no válido"),
      relationship: z.enum(["madre", "padre", "tutor"]),
    }),
    formData,
  );
  if (parsed.errors) return parsed.errors;
  const { family_id, email, relationship } = parsed.data;
  return runAdmin(async (supabase) => {
    const found = check(await supabase.rpc("admin_find_user", { p_email: email }));
    if (!found.length) {
      return {
        error: "No hay ninguna cuenta con ese correo. Pide a la persona que ingrese una vez en la app y vuelve a intentarlo.",
        fieldErrors: { email: ["Sin cuenta"] },
      };
    }
    check(await supabase.from("family_members").insert({ family_id, user_id: found[0].id, relationship }));
    return { ok: true, message: `${found[0].email} vinculado a la familia.` };
  });
}

export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const familyId = String(formData.get("family_id"));
  const userId = String(formData.get("user_id"));
  return runAdmin(async (supabase) => {
    check(await supabase.from("family_members").delete().eq("family_id", familyId).eq("user_id", userId));
    return { ok: true, message: "Quitado de la familia." };
  });
}

export async function linkChild(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const familyId = String(formData.get("family_id"));
  const playerId = String(formData.get("player_id"));
  return runAdmin(async (supabase) => {
    check(await supabase.from("family_players").insert({ family_id: familyId, player_id: playerId }));
    return { ok: true, message: "Vinculado." };
  });
}

export async function unlinkChild(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const familyId = String(formData.get("family_id"));
  const playerId = String(formData.get("player_id"));
  return runAdmin(async (supabase) => {
    check(await supabase.from("family_players").delete().eq("family_id", familyId).eq("player_id", playerId));
    return { ok: true, message: "Desvinculado." };
  });
}
