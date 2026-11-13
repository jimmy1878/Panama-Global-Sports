/**
 * Variables públicas de Supabase. Devuelve null si aún no están configuradas,
 * para que la app siga funcionando (sin login) mientras se completa .env.local.
 * Se accede con nombres literales para que Next.js las incruste en el cliente.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export const SUPABASE_NOT_CONFIGURED =
  "Supabase no está configurado. Completa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local y reinicia el servidor.";

export function requireSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env) throw new Error(SUPABASE_NOT_CONFIGURED);
  return env;
}
