"use server";

import { z } from "zod";
import { sendTest } from "@/features/notifications/send";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PushResult = { ok: true; message?: string } | { ok: false; error: string };

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});

/** Guarda la suscripción Web Push de este dispositivo (RLS: solo la propia). */
export async function saveSubscription(sub: unknown, userAgent: string): Promise<PushResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Ingresa con tu cuenta para activar los avisos." };
  const parsed = subscriptionSchema.safeParse(sub);
  if (!parsed.success) return { ok: false, error: "El navegador devolvió una suscripción no válida." };

  const supabase = await createClient();
  // Si el dispositivo ya estaba registrado con otra cuenta, se reemplaza.
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: userAgent.slice(0, 300),
  });
  if (error) return { ok: false, error: "No se pudo guardar la suscripción. Inténtalo de nuevo." };
  return { ok: true, message: "Avisos activados en este dispositivo." };
}

export async function removeSubscription(endpoint: string): Promise<PushResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Ingresa con tu cuenta." };
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  if (error) return { ok: false, error: "No se pudo desactivar." };
  return { ok: true, message: "Avisos desactivados en este dispositivo." };
}

const prefsSchema = z.object({ match_reminder: z.boolean(), final_result: z.boolean() });

export async function savePreferences(prefs: z.infer<typeof prefsSchema>): Promise<PushResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Ingresa con tu cuenta." };
  const parsed = prefsSchema.safeParse(prefs);
  if (!parsed.success) return { ok: false, error: "Preferencias no válidas." };
  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert({ user_id: user.id, ...parsed.data });
  if (error) return { ok: false, error: "No se pudieron guardar las preferencias." };
  return { ok: true, message: "Preferencias guardadas." };
}

export async function sendTestNotification(): Promise<PushResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Ingresa con tu cuenta." };
  try {
    const result = await sendTest(user.id);
    if ("reason" in result && result.reason) return { ok: false, error: result.reason };
    if (!result.devices) return { ok: false, error: "No hay dispositivos activos. Activa los avisos primero." };
    if (!result.sent) return { ok: false, error: "Hay dispositivos registrados, pero el envío falló. Revisa la configuración del servidor." };
    return { ok: true, message: `Aviso de prueba enviado a ${result.sent} dispositivo(s).` };
  } catch {
    return { ok: false, error: "No se pudo enviar el aviso de prueba." };
  }
}
