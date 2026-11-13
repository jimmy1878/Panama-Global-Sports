import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Sin conexión", robots: { index: false } };

/** La guarda el service worker y se muestra cuando no hay internet. */
export default function OfflinePage() {
  return (
    <section className="mx-auto max-w-sm py-12 text-center">
      <WifiOff className="mx-auto size-12 text-muted" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold">Sin conexión</h1>
      <p className="mt-2 text-muted">
        No hay internet en este momento. Cuando vuelva la señal, toca el botón para recargar.
      </p>
      {/* Enlace normal a propósito: recarga completa y funciona sin JavaScript
          (sin conexión, los archivos JS de la app pueden no estar disponibles). */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-brand-blue px-6 font-semibold text-white"
      >
        Reintentar
      </a>
    </section>
  );
}
