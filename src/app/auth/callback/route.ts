import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/auth";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino del enlace del correo de inicio de sesión.
 * - Plantilla estándar de Supabase: llega `?code=` (flujo PKCE; hay que abrirlo
 *   en el mismo navegador donde se pidió el correo).
 * - Plantilla propia con token_hash: llega `?token_hash=&type=`.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  const fail = NextResponse.redirect(new URL(`/ingresar?error=enlace&next=${encodeURIComponent(next)}`, url.origin));

  if (!getSupabaseEnv()) return fail;
  const supabase = await createClient();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Enlace incompleto") };

  if (error) return fail;
  return NextResponse.redirect(new URL(next, url.origin));
}
