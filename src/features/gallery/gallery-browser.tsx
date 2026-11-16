"use client";

/* eslint-disable @next/next/no-img-element -- URLs firmadas que caducan; next/image no las puede optimizar */

import { useRef, useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { formatDateOnly } from "@/lib/format";
import type { GalleryItem, MatchdayGallery } from "./data";

/**
 * La galería tal como la recorre una familia: una foto grande arriba y, debajo,
 * las jornadas con sus miniaturas. Elegir una foto es instantáneo porque las
 * URLs firmadas ya vienen en la página; no hay que volver al servidor.
 */
export function GalleryBrowser({ jornadas }: { jornadas: MatchdayGallery[] }) {
  const first = jornadas.flatMap((j) => j.items)[0];
  const [selected, setSelected] = useState<GalleryItem | undefined>(first);
  const viewer = useRef<HTMLDivElement>(null);

  function pick(item: GalleryItem) {
    setSelected(item);
    // En móvil el visor queda arriba: hay que subir para verlo
    viewer.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="space-y-6">
      {selected ? <Viewer ref={viewer} item={selected} /> : null}

      {jornadas.map((jornada) => (
        <section key={jornada.matchdayId}>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl tracking-wide uppercase md:text-2xl">Jornada {jornada.number}</h2>
            <span className="text-sm text-muted">
              {jornada.items.length} {jornada.items.length === 1 ? "foto" : "fotos"}
              {jornada.playedOn ? ` · ${formatDateOnly(jornada.playedOn)}` : ""}
            </span>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 md:gap-3">
            {jornada.items.map((item) => {
              const active = item.id === selected?.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => pick(item)}
                    aria-pressed={active}
                    className={`block w-full overflow-hidden rounded-xl border-4 ${
                      active ? "border-gold" : "border-transparent"
                    }`}
                  >
                    <img
                      src={item.thumbUrl ?? item.url ?? ""}
                      alt={item.caption ?? `Foto de la jornada ${jornada.number}`}
                      loading="lazy"
                      className="aspect-square w-full bg-surface-muted object-cover"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Viewer({ item, ref }: { item: GalleryItem; ref: React.Ref<HTMLDivElement> }) {
  const [busy, setBusy] = useState<"descargar" | "compartir" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = `panama-global-sports-${item.id.slice(0, 8)}.webp`;

  async function blob() {
    const response = await fetch(item.url ?? "");
    if (!response.ok) throw new Error("no se pudo descargar");
    return response.blob();
  }

  async function descargar() {
    setBusy("descargar");
    setError(null);
    try {
      const url = URL.createObjectURL(await blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo descargar la foto. Inténtalo de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  async function compartir() {
    setBusy("compartir");
    setError(null);
    try {
      const file = new File([await blob()], name, { type: "image/webp" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: item.caption ?? "Panama Global Sports" });
          return;
        } catch (shareError) {
          if ((shareError as Error).name === "AbortError") return;
        }
      }
      await descargar();
    } catch {
      setError("No se pudo preparar la foto. Inténtalo de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={ref} className="bg-brand-gradient overflow-hidden rounded-3xl border border-gold/25">
      <div className="grid max-h-[55vh] min-h-56 place-items-center bg-navy">
        <img
          src={item.url ?? item.thumbUrl ?? ""}
          alt={item.caption ?? "Foto de la jornada"}
          className="max-h-[55vh] w-full object-contain"
        />
      </div>

      <div className="flex flex-col gap-4 p-4 text-white md:flex-row md:items-center md:justify-between md:p-5">
        <div className="min-w-0">
          <p className="font-bold">{item.caption ?? item.matchLabel ?? "Foto de la jornada"}</p>
          {item.players.length ? (
            <p className="mt-1 text-sm text-white/75">Aparecen: {item.players.join(", ")}</p>
          ) : null}
          {item.caption && item.matchLabel ? (
            <p className="mt-1 text-sm text-white/60">{item.matchLabel}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={descargar}
            disabled={busy !== null}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-5 font-bold text-navy disabled:opacity-60 md:flex-none"
          >
            {busy === "descargar" ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Download className="size-5" aria-hidden />
            )}
            Descargar
          </button>
          <button
            type="button"
            onClick={compartir}
            disabled={busy !== null}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-white px-5 font-bold disabled:opacity-60 md:flex-none"
          >
            {busy === "compartir" ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Share2 className="size-5" aria-hidden />
            )}
            Compartir
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="px-4 pb-4 text-sm font-medium text-gold-bright md:px-5">
          {error}
        </p>
      ) : null}
    </div>
  );
}
