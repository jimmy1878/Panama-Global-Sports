"use client";

import { useSyncExternalStore } from "react";

/** Reloj compartido: avisa cada 15 s para recalcular el minuto. */
const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, 15_000);
  return () => clearInterval(id);
};
const snapshot = () => Math.floor(Date.now() / 15_000);

/** Minuto de juego desde la hora real de inicio (1' en el primer minuto). */
export function minuteSince(startedAt: string, now = Date.now()) {
  return Math.max(1, Math.floor((now - new Date(startedAt).getTime()) / 60_000) + 1);
}

/** "23'" en vivo. En el servidor no se muestra (evita desajustes de hidratación). */
export function LiveMinute({ startedAt, className = "", prefix = "" }: { startedAt: string | null; className?: string; prefix?: string }) {
  const tick = useSyncExternalStore(subscribe, snapshot, () => null);
  if (!startedAt || tick === null) return null;
  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {minuteSince(startedAt)}&apos;
    </span>
  );
}
