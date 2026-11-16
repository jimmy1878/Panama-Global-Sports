"use server";

import { z } from "zod";
import { check, parseForm, refreshPublic, runAdmin, type ActionState } from "@/features/admin/action";
import { fileFrom, processImage } from "@/features/admin/images";

/**
 * Acciones de patrocinios. Las reglas duras (ámbito que existe, exclusividad
 * sin fechas cruzadas) las impone la base; aquí solo se valida la forma y se
 * traduce el error, para que el admin vea algo entendible.
 */

const sponsorSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de la marca").max(120),
  website: z.union([z.url("Enlace no válido"), z.literal("")]).optional(),
  contact_name: z.string().trim().max(120).optional(),
  contact_email: z.union([z.email("Correo no válido"), z.literal("")]).optional(),
});

export async function createSponsor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(sponsorSchema, formData);
  if (parsed.errors) return parsed.errors;
  const logo = fileFrom(formData, "logo");

  return runAdmin(async (supabase) => {
    const created = check(
      await supabase
        .from("sponsors")
        .insert({
          name: parsed.data.name,
          website: parsed.data.website || null,
          contact_name: parsed.data.contact_name || null,
          contact_email: parsed.data.contact_email || null,
        })
        .select("id")
        .single(),
    );

    if (logo) {
      const image = await processImage(logo, { size: 512, fit: "inside" });
      const path = `${created.id}/${Date.now()}.webp`; // nombre nuevo: evita el logo viejo en caché
      check(await supabase.storage.from("sponsor-logos").upload(path, image, { contentType: "image/webp" }));
      check(await supabase.from("sponsors").update({ logo_path: path }).eq("id", created.id));
    }

    refreshPublic("sponsors");
    return { ok: true, message: "Patrocinador creado." };
  });
}

export async function toggleSponsor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(z.object({ id: z.uuid() }), formData);
  if (parsed.errors) return parsed.errors;
  const active = formData.get("active") === "on";
  return runAdmin(async (supabase) => {
    check(await supabase.from("sponsors").update({ active }).eq("id", parsed.data.id));
    refreshPublic("sponsors");
    return { ok: true, message: active ? "Patrocinador activo." : "Patrocinador en pausa: sus logos dejan de verse." };
  });
}

const contractSchema = z.object({
  sponsor_id: z.uuid("Elige un patrocinador"),
  tier_id: z.uuid("Elige un nivel"),
  starts_on: z.string().min(10, "Falta la fecha de inicio"),
  ends_on: z.string().min(10, "Falta la fecha de fin"),
  amount: z.string().trim().optional(),
  status: z.enum(["borrador", "activo", "vencido"]),
});

export async function createContract(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(contractSchema, formData);
  if (parsed.errors) return parsed.errors;
  const { amount, ...rest } = parsed.data;
  if (rest.ends_on < rest.starts_on) {
    return { error: "Revisa los campos marcados.", fieldErrors: { ends_on: ["Termina antes de empezar"] } };
  }

  return runAdmin(async (supabase) => {
    check(await supabase.from("sponsorship_contracts").insert({ ...rest, amount: amount ? Number(amount) : null }));
    refreshPublic("sponsors");
    return { ok: true, message: "Contrato creado." };
  });
}

export async function setContractStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(
    z.object({ id: z.uuid(), status: z.enum(["borrador", "activo", "vencido"]) }),
    formData,
  );
  if (parsed.errors) return parsed.errors;
  return runAdmin(async (supabase) => {
    check(await supabase.from("sponsorship_contracts").update({ status: parsed.data.status }).eq("id", parsed.data.id));
    refreshPublic("sponsors");
    return { ok: true, message: `Contrato marcado como ${parsed.data.status}.` };
  });
}

const placementSchema = z.object({
  contract_id: z.uuid("Elige un contrato"),
  slot_id: z.uuid("Elige un espacio"),
  // "liga:<uuid>": el tipo de ámbito y la fila van siempre juntos
  scope: z.string().regex(/^(organizacion|liga|circuito|torneo|categoria):[0-9a-f-]{36}$/i, "Elige un ámbito"),
  starts_on: z.string().min(10, "Falta la fecha de inicio"),
  ends_on: z.string().min(10, "Falta la fecha de fin"),
  link_url: z.union([z.url("Enlace no válido"), z.literal("")]).optional(),
  text: z.string().trim().max(60).optional(),
  rotation_weight: z.string().trim().optional(),
});

export async function createPlacement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(placementSchema, formData);
  if (parsed.errors) return parsed.errors;
  const { scope, link_url, text, rotation_weight, ...rest } = parsed.data;
  const [kind, id] = scope.split(":");
  if (rest.ends_on < rest.starts_on) {
    return { error: "Revisa los campos marcados.", fieldErrors: { ends_on: ["Termina antes de empezar"] } };
  }

  return runAdmin(async (supabase) => {
    const { error } = await supabase.from("sponsorship_placements").insert({
      ...rest,
      scope: kind as "organizacion" | "liga" | "circuito" | "torneo" | "categoria",
      scope_id: id,
      link_url: link_url || null,
      text: text || null,
      rotation_weight: rotation_weight ? Math.min(100, Math.max(1, Number(rotation_weight))) : 1,
    });
    // Las dos reglas de la base ya explican en español qué pasó; el traductor
    // genérico las convertiría en "un número de camiseta repetido".
    if (error && /^(Ese espacio ya tiene|El ámbito )/.test(error.message)) return { error: error.message };
    if (error) throw error;

    refreshPublic("sponsors");
    return { ok: true, message: "Espacio asignado." };
  });
}

export async function deletePlacement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(z.object({ id: z.uuid() }), formData);
  if (parsed.errors) return parsed.errors;
  return runAdmin(async (supabase) => {
    check(await supabase.from("sponsorship_placements").delete().eq("id", parsed.data.id));
    refreshPublic("sponsors");
    return { ok: true, message: "Asignación retirada." };
  });
}
