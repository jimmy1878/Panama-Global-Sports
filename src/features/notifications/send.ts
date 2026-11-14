import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import type { Enums } from "@/types/database";
import { createServiceClient } from "@/lib/supabase/admin";

export type PushPayload = { title: string; body: string; url: string; tag?: string };
export type NotificationKind = Enums<"notification_kind">;

/** Columna de preferencias que controla cada tipo de aviso. */
const PREF_COLUMN: Record<NotificationKind, "match_reminder" | "final_result" | "album_packs"> = {
  match_reminder: "match_reminder",
  final_result: "final_result",
  album_packs: "album_packs",
};

let vapidReady: boolean | null = null;
function setupVapid() {
  if (vapidReady !== null) return vapidReady;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  vapidReady = Boolean(publicKey && privateKey);
  if (vapidReady) setVapidDetails(subject, publicKey!, privateKey!);
  return vapidReady;
}

export function pushConfigured() {
  return setupVapid() && createServiceClient() !== null;
}

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

/** Envía a todos los dispositivos de un usuario. Borra suscripciones caducadas. */
async function sendToSubscriptions(subs: Subscription[], payload: PushPayload) {
  const supabase = createServiceClient()!;
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 6 * 3600, urgency: "normal" },
        );
        sent++;
        await supabase.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id); // el navegador la anuló
        } else {
          console.error("Error enviando push", status, (error as Error).message);
        }
      }
    }),
  );
  return sent;
}

/**
 * Avisa a los usuarios indicados, respetando sus preferencias y sin repetir:
 * notification_log registra (usuario, tipo, partido) y solo se envía la primera vez.
 */
export async function notifyUsers(opts: { userIds: string[]; kind: NotificationKind; matchId: string; payload: PushPayload }) {
  if (!pushConfigured()) return { sent: 0, recipients: 0, reason: "Notificaciones no configuradas en el servidor." };
  const supabase = createServiceClient()!;
  const userIds = [...new Set(opts.userIds)];
  if (!userIds.length) return { sent: 0, recipients: 0 };

  const { data: prefs, error: prefsError } = await supabase
    .from("notification_preferences")
    .select("user_id")
    .in("user_id", userIds)
    .eq(PREF_COLUMN[opts.kind], true);
  if (prefsError) throw prefsError;
  const wanted = prefs.map((p) => p.user_id);
  if (!wanted.length) return { sent: 0, recipients: 0 };

  // Registro anti-duplicados: devuelve solo las filas nuevas (las repetidas se ignoran).
  const { data: fresh, error: logError } = await supabase
    .from("notification_log")
    .upsert(
      wanted.map((user_id) => ({ user_id, kind: opts.kind, match_id: opts.matchId })),
      { onConflict: "user_id,kind,match_id", ignoreDuplicates: true },
    )
    .select("user_id");
  if (logError) throw logError;
  const recipients = fresh.map((f) => f.user_id);
  if (!recipients.length) return { sent: 0, recipients: 0 };

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", recipients);
  if (subsError) throw subsError;

  const sent = await sendToSubscriptions(subs, opts.payload);
  return { sent, recipients: recipients.length };
}

/** Aviso de prueba a todos los dispositivos de un usuario (sin registro ni preferencias). */
export async function sendTest(userId: string) {
  if (!pushConfigured()) return { sent: 0, reason: "Notificaciones no configuradas en el servidor." };
  const supabase = createServiceClient()!;
  const { data: subs, error } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  if (error) throw error;
  const sent = await sendToSubscriptions(subs, {
    title: "¡Avisos activados!",
    body: "Así te avisaremos de los partidos de tus equipos.",
    url: "/avisos",
    tag: "prueba",
  });
  return { sent, devices: subs.length };
}

/** Usuarios que siguen a alguno de estos equipos. */
export async function followersOf(teamIds: string[]) {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("team_follows").select("user_id").in("team_id", teamIds);
  if (error) throw error;
  return [...new Set(data.map((d) => d.user_id))];
}
