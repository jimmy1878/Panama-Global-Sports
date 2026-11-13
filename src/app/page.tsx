import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, ChartColumn, Radio } from "lucide-react";
import { EmptyState, Section, Skeleton } from "@/components/ui/section";
import { MatchCard } from "@/features/league/components/match-list";
import { getCategories, getCurrentSeason, getHomeMatches, type Category, type Match } from "@/features/league/data";
import { formatDateOnly } from "@/lib/format";

export default function Home() {
  return (
    <div className="space-y-8 md:space-y-10">
      <Suspense fallback={<Skeleton className="h-36 md:h-44" />}>
        <SeasonHero />
      </Suspense>
      <Suspense fallback={<HomeSkeleton />}>
        <HomeMatches />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-40" />}>
        <CategoryLinks />
      </Suspense>
    </div>
  );
}

async function SeasonHero() {
  const season = await getCurrentSeason();
  return (
    <section className="relative overflow-hidden rounded-3xl bg-brand-blue p-6 text-white md:p-10">
      <div aria-hidden className="absolute -right-10 -bottom-16 size-48 rounded-full bg-white/10 md:size-72" />
      <div aria-hidden className="absolute top-6 right-6 h-1.5 w-16 rounded-full bg-brand-red md:w-24" />
      <p className="text-sm font-medium text-white/80">Ligas infantiles de fútbol</p>
      <h1 className="mt-1 text-2xl font-black md:text-4xl">Panama Global Sports</h1>
      {season ? (
        <p className="mt-3 text-sm text-white/90 md:text-base">
          {season.name} · del {formatDateOnly(season.startsOn)} al {formatDateOnly(season.endsOn)}
        </p>
      ) : null}
      <div className="mt-5 flex gap-3">
        <Link href="/calendario" className="flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-brand-blue">
          <CalendarDays className="size-4" aria-hidden />
          Calendario
        </Link>
        <Link href="/estadisticas" className="flex h-11 items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-semibold">
          <ChartColumn className="size-4" aria-hidden />
          Posiciones
        </Link>
      </div>
    </section>
  );
}

async function HomeMatches() {
  const season = await getCurrentSeason();
  if (!season) return <EmptyState>No hay una temporada activa.</EmptyState>;
  const [{ live, upcoming, recent }, categories] = await Promise.all([getHomeMatches(season.id), getCategories()]);
  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <>
      {live.length ? (
        <Section title="En vivo ahora">
          <p className="-mt-2 mb-3 flex items-center gap-1.5 text-xs text-muted">
            <Radio className="size-3.5 text-brand-red" aria-hidden />
            Recarga para ver el marcador actualizado.
          </p>
          <CardGrid matches={live} catById={catById} />
        </Section>
      ) : null}

      {/* Móvil: una columna. Desktop: próximos y resultados lado a lado. */}
      <div className="grid gap-8 md:grid-cols-2 md:gap-8">
        <Section title="Próximos partidos" href="/calendario">
          {upcoming.length ? <CardGrid matches={upcoming} catById={catById} /> : <EmptyState>No hay partidos programados.</EmptyState>}
        </Section>
        <Section title="Últimos resultados" href="/calendario">
          {recent.length ? <CardGrid matches={recent} catById={catById} /> : <EmptyState>Aún no hay resultados.</EmptyState>}
        </Section>
      </div>
    </>
  );
}

function CardGrid({ matches, catById }: { matches: Match[]; catById: Map<string, Category> }) {
  return (
    <ul className="grid gap-3">
      {matches.map((m) => (
        <li key={m.id}>
          <MatchCard match={m} category={catById.get(m.categoryId)} />
        </li>
      ))}
    </ul>
  );
}

async function CategoryLinks() {
  const categories = await getCategories();
  const leagues = [...new Map(categories.map((c) => [c.leagueId, c.leagueName])).entries()];
  return (
    <Section title="Categorías">
      <div className="grid gap-4 md:grid-cols-2">
        {leagues.map(([leagueId, leagueName]) => (
          <div key={leagueId} className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="mb-3 font-semibold">{leagueName}</h3>
            <ul className="grid grid-cols-5 gap-2">
              {categories
                .filter((c) => c.leagueId === leagueId)
                .map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/estadisticas?cat=${c.key}`}
                      className="flex h-11 items-center justify-center rounded-xl bg-surface-muted text-sm font-bold hover:bg-brand-blue hover:text-white"
                    >
                      {c.code}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

function HomeSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Skeleton className="h-80" />
      <Skeleton className="h-80" />
    </div>
  );
}
