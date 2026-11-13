import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { requireSupabaseEnv } from "./env";

/**
 * Cliente de solo lectura para datos PÚBLICOS (sin cookies ni sesión).
 * Al no depender del usuario, sus consultas se pueden guardar en caché con
 * 'use cache' y las páginas cargan al instante. RLS limita lo que ve a lo público.
 */
export function createPublicClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** URL pública de un logo del bucket "team-logos" (público). */
export function teamLogoUrl(path: string | null): string | null {
  if (!path) return null;
  const { url } = requireSupabaseEnv();
  return `${url}/storage/v1/object/public/team-logos/${path}`;
}
