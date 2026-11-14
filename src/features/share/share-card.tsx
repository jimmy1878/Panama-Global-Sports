"use client";

import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";

/**
 * Botones para compartir la tarjeta de resultado.
 *
 * En el celular abre el menú nativo (`navigator.share` con archivo), que es
 * donde están WhatsApp e Instagram. En computadora —o si el navegador no
 * admite compartir archivos— descarga el PNG.
 */

const FORMATS = [
  { key: "historia", label: "Instagram", hint: "vertical 4:5" },
  { key: "cuadrada", label: "WhatsApp", hint: "cuadrada 1:1" },
] as const;

type Format = (typeof FORMATS)[number]["key"];

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function ShareCard({ matchId, title }: { matchId: string; title: string }) {
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function share(format: Format) {
    setBusy(format);
    setError(null);
    try {
      const response = await fetch(`/partidos/${matchId}/tarjeta?formato=${format}`);
      if (!response.ok) throw new Error("La imagen no se pudo generar");
      const blob = await response.blob();
      const file = new File([blob], `panama-global-sports-${format}.png`, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title });
          return;
        } catch (shareError) {
          // El usuario cerró el menú: no es un error que haya que mostrar.
          if ((shareError as Error).name === "AbortError") return;
          // Safari exige que share() salga del toque; si se queja, descargamos.
        }
      }
      download(blob, file.name);
    } catch {
      setError("No se pudo preparar la imagen. Inténtalo de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Compartir el resultado</h2>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        {/* Vista previa: la misma imagen que se comparte */}
        {/* eslint-disable-next-line @next/next/no-img-element -- PNG generado en servidor; next/image no aporta aquí */}
        <img
          src={`/partidos/${matchId}/tarjeta?formato=cuadrada`}
          alt="Vista previa de la tarjeta de resultado"
          loading="lazy"
          className="mx-auto w-40 rounded-2xl border border-border bg-surface-muted md:mx-0"
          width={1080}
          height={1080}
        />

        <div className="flex flex-col gap-3 md:flex-1">
          {FORMATS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => share(f.key)}
              disabled={busy !== null}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 py-3 font-bold text-white disabled:opacity-60 md:justify-start"
            >
              {busy === f.key ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Share2 className="size-5" aria-hidden />
              )}
              {f.label}
              <span className="text-sm font-medium opacity-80">({f.hint})</span>
            </button>
          ))}
          <p className="text-xs text-muted">
            En el celular se abre el menú de compartir; en computadora se descarga la imagen.
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-brand-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
