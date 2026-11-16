import Link from "next/link";
import { Suspense } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { BrandBackdrop } from "@/components/layout/brand-backdrop";
import { sponsorContext } from "@/features/sponsors/context";
import { SponsorSlot } from "@/features/sponsors/slot";
import type { Category, Tournament } from "../data";
import { CATEGORY_VIEWS, categoryPath, type CategoryView } from "../paths";

/**
 * Cabecera de la pantalla de categoría: el contexto completo (liga · circuito ·
 * torneo), la categoría en grande y las pestañas.
 *
 * En el mockup es una banda navy de borde a borde; aquí es una pieza de marca
 * redondeada, porque el contenido de la app vive dentro de un `main` con
 * márgenes. El degradado y el balón son los mismos del header.
 */
export function CategoryHeader({
  category,
  tournament,
  tournaments,
  view,
}: {
  category: Category;
  tournament: Tournament;
  tournaments: Tournament[];
  view: CategoryView;
}) {
  const leagueColor = category.leagueGender === "girls" ? "var(--girls)" : "var(--boys)";
  const others = tournaments.filter((t) => t.id !== tournament.id);
  const context = [
    category.leagueName.replace(" Champions League", "").toUpperCase(),
    tournament.circuitName.toUpperCase(),
    `${tournament.typeName.toUpperCase()} ${tournament.year}`,
  ].join(" · ");

  return (
    <header className="bg-brand-gradient relative overflow-hidden rounded-3xl border border-gold/25 pt-4 text-white md:pt-6">
      <BrandBackdrop className="opacity-60" />

      <div className="relative flex items-start gap-3 px-4 md:px-6">
        <Link
          href="/"
          aria-label="Volver al inicio"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15 transition-colors hover:bg-white/25"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>

        {/* Barra del color de la liga: es su identidad y no tenemos logo propio */}
        <span aria-hidden className="mt-1 h-12 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: leagueColor }} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-black tracking-widest md:text-xs" style={{ color: leagueColor }}>
            {context}
          </p>
          <h1 className="font-display text-3xl leading-none tracking-wide md:text-4xl">{category.code}</h1>
          <p className="mt-1 text-xs text-white/70 md:text-sm">
            {category.name} · {category.leagueName}
          </p>
        </div>

        <TournamentPicker current={tournament} others={others} category={category} view={view} />
      </div>

      {/* Patrocinio de la liga y del torneo. Si nadie los tiene, no hay franja. */}
      <Suspense fallback={null}>
        <SponsorStrip category={category} tournament={tournament} />
      </Suspense>

      {/* Pestañas: en móvil se desplazan a lo ancho, como en el diseño */}
      <nav aria-label="Secciones de la categoría" className="relative mt-4 flex gap-1 overflow-x-auto px-4 md:px-6">
        {CATEGORY_VIEWS.map((v) => {
          const active = v.key === view;
          return (
            <Link
              key={v.key}
              href={categoryPath(category, tournament, v.key)}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 shrink-0 items-center rounded-t-xl px-4 text-sm font-bold whitespace-nowrap ${
                active ? "bg-background text-foreground" : "text-white/80 hover:text-white"
              }`}
            >
              {v.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

/**
 * Los dos espacios de patrocinio de esta pantalla. Van juntos, alineados a la
 * derecha, y la franja entera desaparece si ninguno está vendido.
 */
async function SponsorStrip({ category, tournament }: { category: Category; tournament: Tournament }) {
  const context = await sponsorContext({ category, tournament });
  return (
    <div className="relative mt-3 flex flex-wrap items-center justify-end gap-x-6 gap-y-2 px-4 empty:mt-0 md:px-6">
      <SponsorSlot code="liga_header" context={context} />
      <SponsorSlot code="torneo_header" context={context} />
    </div>
  );
}

/**
 * Selector de torneo. La misma categoría puede jugarse en varios torneos a la
 * vez (Academias y Escolares) y en los de años anteriores, que ya están en el
 * historial. Es un `<details>`: no necesita JavaScript.
 */
function TournamentPicker({
  current,
  others,
  category,
  view,
}: {
  current: Tournament;
  others: Tournament[];
  category: Category;
  view: CategoryView;
}) {
  if (!others.length) {
    return (
      <span className="hidden h-11 shrink-0 items-center rounded-xl border-2 border-white/40 px-3 text-sm font-bold sm:flex">
        {current.typeName} {current.year}
      </span>
    );
  }

  return (
    <details className="relative shrink-0">
      <summary className="flex h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl border-2 border-white px-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
        <span className="hidden sm:inline">
          {current.typeName} {current.year}
        </span>
        <span className="sm:hidden">Torneo</span>
        <ChevronDown className="size-4" aria-hidden />
      </summary>
      <ul className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-border bg-surface p-1 text-foreground shadow-xl">
        {others.map((t) => (
          <li key={t.id}>
            <Link
              href={categoryPath(category, t, view)}
              className="block rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-surface-muted"
            >
              <span className="block">{t.name}</span>
              <span className="block text-xs text-muted">
                {t.status === "en_curso" ? "En curso" : t.status === "finalizado" ? "Historial" : "Próximo"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
