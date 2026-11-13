"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth";
import { SUPABASE_NOT_CONFIGURED, getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  step: "email" | "code";
  email: string;
  error?: string;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Inicio de sesión con código por email (sin contraseña). Se usa código y no
 * enlace mágico porque en una PWA instalada el enlace se abre en el navegador
 * y no en la app. Si el email no existe, Supabase crea la cuenta (rol 'parent').
 */
export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = formData.get("intent");
  const email = String(formData.get("email") ?? prev.email).trim().toLowerCase();

  if (intent === "change-email") return { step: "email", email };
  if (!getSupabaseEnv()) return { ...prev, error: SUPABASE_NOT_CONFIGURED };

  if (!EMAIL_RE.test(email)) {
    return { step: "email", email, error: "Escribe un correo válido." };
  }

  const supabase = await createClient();

  if (intent === "send") {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) {
      return {
        step: "email",
        email,
        error:
          error.status === 429
            ? "Pediste muchos códigos seguidos. Espera un minuto y vuelve a intentar."
            : "No pudimos enviar el código. Revisa el correo e inténtalo de nuevo.",
      };
    }
    return { step: "code", email, message: `Te enviamos un código a ${email}.` };
  }

  if (intent === "verify") {
    const token = String(formData.get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6,8}$/.test(token)) {
      return { step: "code", email, error: "El código tiene 6 dígitos." };
    }
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) {
      return { step: "code", email, error: "Código incorrecto o vencido. Pide uno nuevo si hace falta." };
    }
    redirect(safeNextPath(formData.get("next")));
  }

  return prev;
}

export async function signOutAction() {
  if (getSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
