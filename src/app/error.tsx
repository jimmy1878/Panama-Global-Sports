"use client";

import { RefreshCw } from "lucide-react";

/** Error inesperado (p. ej. no responde la base de datos). */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto max-w-sm py-12 text-center">
      <h1 className="text-2xl font-bold">Algo salió mal</h1>
      <p className="mt-2 text-muted">No pudimos cargar esta información. Revisa tu conexión e inténtalo de nuevo.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-blue px-6 font-semibold text-white"
      >
        <RefreshCw className="size-4" aria-hidden />
        Reintentar
      </button>
    </section>
  );
}
