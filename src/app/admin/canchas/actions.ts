"use server";

import { z } from "zod";
import { check, parseForm, refreshPublic, runAdmin, type ActionState } from "@/features/admin/action";

const venueSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(60),
  address: z.string().trim().max(200).optional(),
  maps_url: z.union([z.url("Enlace no válido"), z.literal("")]).optional(),
});

function clean(v: z.infer<typeof venueSchema>) {
  return { name: v.name, address: v.address || null, maps_url: v.maps_url || null };
}

export async function createVenue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(venueSchema, formData);
  if (parsed.errors) return parsed.errors;
  return runAdmin(async (supabase) => {
    check(await supabase.from("venues").insert(clean(parsed.data)));
    refreshPublic("matches");
    return { ok: true, message: "Cancha creada." };
  });
}

export async function updateVenue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(venueSchema.extend({ id: z.uuid() }), formData);
  if (parsed.errors) return parsed.errors;
  const active = formData.get("is_active") === "on";
  return runAdmin(async (supabase) => {
    check(await supabase.from("venues").update({ ...clean(parsed.data), is_active: active }).eq("id", parsed.data.id));
    refreshPublic("matches");
  });
}
