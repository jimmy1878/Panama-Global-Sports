"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Escucha cambios en tiempo real (Supabase Realtime) y recarga los datos de la
 * página. Las acciones del delegado ya refrescaron la caché del servidor, así
 * que router.refresh() trae el marcador nuevo. Se espera un instante para
 * agrupar varios cambios seguidos (gol + asistencia).
 */
export function LiveRefresher({ matchId, delayMs = 800 }: { matchId?: string; delayMs?: number }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return; // Supabase sin configurar: no hay tiempo real.
    }
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), delayMs);
    };

    const channel = supabase.channel(matchId ? `match-${matchId}` : "matches-live");
    if (matchId) {
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "match_mvps", filter: `match_id=eq.${matchId}` }, refresh);
    } else {
      // Inicio: cualquier partido que empiece, cambie de marcador o termine.
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches" }, refresh);
    }
    channel.subscribe();

    // Al volver a la app (pantalla bloqueada, otra pestaña) se recarga por si se perdió algo.
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [matchId, delayMs, router]);

  return null;
}
