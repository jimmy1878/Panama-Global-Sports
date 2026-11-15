import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ImageOff, Lock } from "lucide-react";
import { EmptyState, PageTitle, Skeleton } from "@/components/ui/section";
import { getGalleryByMatchday } from "@/features/gallery/data";
import { getCurrentUser } from "@/lib/auth";
import { formatDateOnly } from "@/lib/format";

export const metadata: Metadata = { title: "Galería", robots: { index: false } };

export default function GaleriaPage() {
  return (
    <div>
      <PageTitle title="Galería" subtitle="Las fotos de cada jornada, solo para las familias de la liga." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <GalleryContent />
      </Suspense>
    </div>
  );
}

async function GalleryContent() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <EmptyState>
        <span className="flex flex-col items-center gap-3">
          <Lock className="size-6 text-muted" aria-hidden />
          Las fotos son solo para las familias de la liga.
          <Link
            href="/ingresar?next=/galeria"
            className="flex min-h-11 items-center rounded-xl bg-brand-blue px-5 font-semibold text-white"
          >
            Ingresar
          </Link>
        </span>
      </EmptyState>
    );
  }

  const jornadas = await getGalleryByMatchday();
  if (jornadas.length === 0) {
    return (
      <EmptyState>
        <span className="flex flex-col items-center gap-2">
          <ImageOff className="size-6 text-muted" aria-hidden />
          Todavía no hay fotos aprobadas.
        </span>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-10">
      {jornadas.map((jornada) => (
        <section key={jornada.matchdayId}>
          <h2 className="mb-1 text-lg font-bold">Jornada {jornada.number}</h2>
          <p className="mb-3 text-sm text-muted">
            {jornada.leagueName} · {jornada.tournamentName}
            {jornada.playedOn ? ` · ${formatDateOnly(jornada.playedOn)}` : ""}
          </p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-3">
            {jornada.items.map((item) => (
              <li key={item.id}>
                <a href={item.url ?? "#"} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada que caduca; next/image no la puede optimizar */}
                  <img
                    src={item.thumbUrl ?? item.url ?? ""}
                    alt={item.caption ?? `Foto de la jornada ${jornada.number}`}
                    loading="lazy"
                    className="aspect-square w-full rounded-xl border border-border bg-surface-muted object-cover"
                  />
                </a>
                {item.caption ? <p className="mt-1 text-xs text-muted">{item.caption}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted">
        Las fotos se pueden descargar y compartir. Si prefieres que la de tu hijo no aparezca, puedes
        retirar el consentimiento desde{" "}
        <Link href="/familia" className="font-medium text-brand-blue">
          Mi familia
        </Link>
        : se ocultan al instante.
      </p>
    </div>
  );
}
