import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ImageOff, Lock } from "lucide-react";
import { EmptyState, PageTitle, Skeleton } from "@/components/ui/section";
import { GalleryBrowser } from "@/features/gallery/gallery-browser";
import {
  getGalleryByMatchday,
  getGalleryTournaments,
  type GalleryTournament,
} from "@/features/gallery/data";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Galería", robots: { index: false } };

const LEAGUES = [
  { key: "todas", label: "Todas" },
  { key: "boys", label: "Boys" },
  { key: "girls", label: "Girls" },
] as const;

type LeagueKey = (typeof LEAGUES)[number]["key"];

/** Un torneo del selector. Boys y Girls comparten slug, así que se agrupan. */
type Option = {
  slug: string;
  name: string;
  current: boolean;
  photos: number;
  ids: string[];
};

export default function GaleriaPage({ searchParams }: PageProps<"/galeria">) {
  return (
    <div>
      <PageTitle title="Galería" subtitle="Las fotos de cada jornada, solo para las familias de la liga." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        {searchParams.then((sp) => (
          <GalleryContent torneo={one(sp.torneo)} liga={resolveLeague(sp.liga)} />
        ))}
      </Suspense>
    </div>
  );
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function resolveLeague(value: string | string[] | undefined): LeagueKey {
  const wanted = one(value);
  return LEAGUES.find((l) => l.key === wanted)?.key ?? "todas";
}

/** Los torneos de la lista, agrupados por slug (Boys y Girls comparten el suyo). */
function toOptions(tournaments: GalleryTournament[], liga: LeagueKey): Option[] {
  const bySlug = new Map<string, Option>();
  for (const t of tournaments) {
    if (liga !== "todas" && t.leagueGender !== liga) continue;
    const option = bySlug.get(t.slug) ?? {
      slug: t.slug,
      name: t.name,
      current: false,
      photos: 0,
      ids: [],
    };
    option.current ||= t.status === "en_curso";
    option.photos += t.photos;
    option.ids.push(t.id);
    bySlug.set(t.slug, option);
  }
  return [...bySlug.values()];
}

async function GalleryContent({ torneo, liga }: { torneo: string | undefined; liga: LeagueKey }) {
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

  const tournaments = await getGalleryTournaments();
  if (!tournaments.length) {
    return (
      <EmptyState>
        <span className="flex flex-col items-center gap-2">
          <ImageOff className="size-6 text-muted" aria-hidden />
          Todavía no hay fotos aprobadas.
        </span>
      </EmptyState>
    );
  }

  const options = toOptions(tournaments, liga);
  const selected = options.find((o) => o.slug === torneo) ?? options[0];
  const jornadas = selected
    ? await getGalleryByMatchday({
        tournamentIds: selected.ids,
        leagueGender: liga === "todas" ? undefined : liga,
      })
    : [];

  return (
    <div className="space-y-5">
      <LeagueFilter current={liga} torneo={selected?.slug} />

      {/* Móvil: el selector de torneo va arriba, plegado. Desktop: barra lateral. */}
      <div className="md:flex md:items-start md:gap-6">
        <TournamentPicker options={options} selected={selected} liga={liga} />

        <div className="mt-5 min-w-0 flex-1 md:mt-0">
          {jornadas.length ? (
            <GalleryBrowser key={`${liga}-${selected?.slug}`} jornadas={jornadas} />
          ) : (
            <EmptyState>
              <span className="flex flex-col items-center gap-2">
                <ImageOff className="size-6 text-muted" aria-hidden />
                Todavía no hay fotos de este torneo.
              </span>
            </EmptyState>
          )}

          <p className="mt-6 text-xs text-muted">
            Solo publicamos fotos de niños con consentimiento. Si prefieres que la de tu hijo no
            aparezca, puedes retirarlo desde{" "}
            <Link href="/familia" className="font-medium text-brand-blue">
              Mi familia
            </Link>
            : se ocultan al instante.
          </p>
        </div>
      </div>
    </div>
  );
}

function LeagueFilter({ current, torneo }: { current: LeagueKey; torneo: string | undefined }) {
  return (
    <div role="group" aria-label="Liga" className="flex gap-1 rounded-2xl border border-border bg-surface p-1">
      {LEAGUES.map((l) => {
        const active = l.key === current;
        return (
          <Link
            key={l.key}
            href={href(torneo, l.key)}
            aria-current={active ? "true" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm font-bold ${
              active ? "bg-navy text-white" : "text-foreground hover:bg-surface-muted"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}

function TournamentPicker({
  options,
  selected,
  liga,
}: {
  options: Option[];
  selected: Option | undefined;
  liga: LeagueKey;
}) {
  const current = options.filter((o) => o.current);
  const past = options.filter((o) => !o.current);

  const list = (title: string, group: Option[]) =>
    group.length ? (
      <>
        <p className="px-3 pt-3 pb-1 text-[11px] font-black tracking-widest text-muted uppercase">{title}</p>
        {group.map((o) => {
          const active = o.slug === selected?.slug;
          return (
            <Link
              key={o.slug}
              href={href(o.slug, liga)}
              aria-current={active ? "true" : undefined}
              className={`flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-sm ${
                active ? "bg-navy font-bold text-white" : "font-medium hover:bg-surface-muted"
              }`}
            >
              <span className="truncate">{o.name}</span>
              <span className={`shrink-0 text-xs ${active ? "text-white/70" : "text-muted"}`}>{o.photos}</span>
            </Link>
          );
        })}
      </>
    ) : null;

  const inner = (
    <>
      {list("Torneo actual", current)}
      {list("Torneos anteriores", past)}
    </>
  );

  return (
    <>
      {/* Móvil: plegado, para no empujar las fotos fuera de la pantalla */}
      <details className="rounded-2xl border border-border bg-surface p-1 md:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 font-bold [&::-webkit-details-marker]:hidden">
          <span className="truncate">{selected?.name ?? "Elegir torneo"}</span>
          <span className="text-xs font-medium text-brand-blue">Cambiar</span>
        </summary>
        {inner}
      </details>

      {/* Desktop: barra lateral siempre visible */}
      <nav
        aria-label="Torneos con fotos"
        className="hidden w-64 shrink-0 rounded-2xl border border-border bg-surface p-1 md:block"
      >
        {inner}
      </nav>
    </>
  );
}

function href(torneo: string | undefined, liga: LeagueKey) {
  const params = new URLSearchParams();
  if (torneo) params.set("torneo", torneo);
  if (liga !== "todas") params.set("liga", liga);
  const query = params.toString();
  return query ? `/galeria?${query}` : "/galeria";
}
