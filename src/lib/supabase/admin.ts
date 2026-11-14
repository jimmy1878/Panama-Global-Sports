import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/**
 * Cliente con la clave de servicio: IGNORA RLS. Solo para tareas del servidor
 * sin usuario (cron, envío de notificaciones). Nunca importar desde código de
 * cliente ni exponer sus datos sin filtrar. Devuelve null si falta la clave.
 */
export function createServiceClient() {
  const env = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !serviceKey) return null;
  return createClient<Database>(env.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
