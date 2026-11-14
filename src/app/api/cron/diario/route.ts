import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sendTomorrowReminders } from "@/features/notifications/match-alerts";
import { createServiceClient } from "@/lib/supabase/admin";

/**
 * Tarea diaria (Vercel Cron, ver vercel.json — 22:00 UTC = 5:00 p. m. en Panamá):
 *  1. Recordatorio de los partidos de mañana a quienes siguen a cada equipo.
 *  2. Cierre de las votaciones MVP vencidas.
 * Protegida con CRON_SECRET: Vercel envía "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const authorized =
    Boolean(secret) && header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  if (!authorized) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });

  const reminders = await sendTomorrowReminders();
  const { data: closedVotes, error } = await supabase.rpc("close_expired_mvp_votes");
  if (error) console.error("close_expired_mvp_votes", error.message);

  return NextResponse.json({ ok: true, reminders, closedVotes: closedVotes ?? 0 });
}
