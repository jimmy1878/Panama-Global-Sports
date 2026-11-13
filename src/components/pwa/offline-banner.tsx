"use client";

import { useOffline } from "next/offline";
import { WifiOff } from "lucide-react";

/** Aviso cuando se pierde la conexión. Next reintenta solo al volver la señal. */
export function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 flex items-center justify-center gap-2 bg-foreground px-4 py-2 text-sm text-white md:top-16"
    >
      <WifiOff className="size-4" aria-hidden />
      Sin conexión. Se actualizará al volver la señal.
    </div>
  );
}
