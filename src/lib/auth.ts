import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { AppRole } from "@/types/database";
import { getSupabaseEnv } from "./supabase/env";
import { createClient } from "./supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  delegate: "Delegado / Árbitro",
  parent: "Familia",
};

/**
 * Usuario actual (o null). Única puerta de lectura de la sesión (Data Access Layer).
 * Lee cookies: úsalo dentro de un <Suspense>. `cache` evita repetir la consulta
 * en la misma petición.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!getSupabaseEnv()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const { sub, email } = data.claims;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", sub)
    .maybeSingle();

  return {
    id: sub,
    email: typeof email === "string" ? email : null,
    fullName: profile?.full_name ?? null,
    role: (profile?.role as AppRole | undefined) ?? "parent",
  };
});

/** Exige sesión; si no hay, lleva a /ingresar y vuelve a `next` después. */
export async function requireUser(next = "/"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(next)}`);
  return user;
}

/** Exige uno de los roles indicados. La seguridad real la impone RLS en la BD. */
export async function requireRole(roles: AppRole[], next = "/"): Promise<CurrentUser> {
  const user = await requireUser(next);
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

/** Solo rutas internas: evita redirecciones abiertas a otros sitios. */
export function safeNextPath(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/mas";
}
