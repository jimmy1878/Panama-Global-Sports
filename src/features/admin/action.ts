import "server-only";
import { unstable_rethrow } from "next/navigation";
import { updateTag } from "next/cache";
import type { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Resultado que devuelven todas las acciones del panel a sus formularios. */
export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Envoltorio de toda acción de admin: verifica el rol, entrega el cliente con
 * sesión (RLS hace cumplir los permisos en la BD) y traduce los errores.
 */
export async function runAdmin(fn: (supabase: Supabase, userId: string) => Promise<ActionState | void>): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "No autorizado." };
  try {
    const result = await fn(await createClient(), user.id);
    return result ?? { ok: true, message: "Guardado." };
  } catch (error) {
    unstable_rethrow(error); // deja pasar redirect() y notFound()
    return { error: humanizeError(error) };
  }
}

/** Valida un formulario con zod; devuelve los datos o los errores por campo. */
export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): { data: z.infer<T>; errors?: undefined } | { data?: undefined; errors: ActionState } {
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { data: parsed.data };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { errors: { error: "Revisa los campos marcados.", fieldErrors } };
}

/** Lanza si la consulta de Supabase falló (lo captura runAdmin). */
export function check<T>(result: { data: T; error: { message: string; code?: string } | null }): NonNullable<T> {
  if (result.error) throw result.error;
  return result.data as NonNullable<T>;
}

/** Refresca al instante las páginas públicas que usan estos datos. */
export function refreshPublic(...tags: string[]) {
  for (const tag of tags) updateTag(tag);
}

function humanizeError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  switch (e?.code) {
    case "23505":
      return "Ya existe un registro con esos datos (por ejemplo, un número de camiseta o un nombre repetido).";
    case "23503":
      return "No se puede: hay datos relacionados (por ejemplo, partidos o jugadores asociados).";
    case "23514":
      return "Algún dato no es válido. Revisa el formulario.";
    case "42501":
      return "No tienes permiso para hacer esto.";
    case "P0001":
      return e.message ?? "No se pudo completar la acción.";
    default:
      return e?.message ? `No se pudo guardar: ${e.message}` : "No se pudo guardar. Inténtalo de nuevo.";
  }
}
