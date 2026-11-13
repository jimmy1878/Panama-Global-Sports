import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/**
 * Refresca la sesión de Supabase en cada petición y reenvía las cookies
 * actualizadas al navegador. Se llama desde src/proxy.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = getSupabaseEnv();
  if (!env) return response; // Sin configurar todavía: la app funciona sin login.

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // Evita que una CDN guarde en caché respuestas con cookies de sesión.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // No poner lógica entre la creación del cliente y esta llamada:
  // getClaims() valida el token y dispara el refresco si venció.
  await supabase.auth.getClaims();

  return response;
}
