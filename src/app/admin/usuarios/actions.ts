"use server";

import { z } from "zod";
import { check, parseForm, runAdmin, type ActionState } from "@/features/admin/action";

export async function changeRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(z.object({ user_id: z.uuid(), role: z.enum(["admin", "delegate", "parent"]) }), formData);
  if (parsed.errors) return parsed.errors;
  const { user_id, role } = parsed.data;
  return runAdmin(async (supabase, me) => {
    if (user_id === me && role !== "admin") {
      return { error: "No puedes quitarte el rol de administrador a ti mismo (te quedarías sin acceso)." };
    }
    check(await supabase.from("profiles").update({ role }).eq("id", user_id));
    return { ok: true, message: "Rol actualizado." };
  });
}
