import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, ChartColumn } from "lucide-react";
import { EmptyState, Section, Skeleton } from "@/components/ui/section";
import { LiveRefresher } from "@/components/live/live-refresher";
import { LiveHero } from "@/features/league/components/live-hero";
import { TournamentCards } from "@/features/league/components/tournament-cards";
import { UpcomingBanner } from "@/features/league/components/upcoming-banner";
import { WeekMvpCard } from "@/features/league/components/week-mvp";
import { MatchCard, ResultCard } from "@/features/league/components/match-list";
import {
  getCategories,
  getCategoriesByTournament,
  getCurrentTournaments,
  getHomeMatches,
  getTournamentProgress,
  getTournaments,
  getWeekMvp,
  type Category,
  type Match,
  type Tournament,
} from "@/features/league/data";

export default function Home() {
  return (
    <div className="space-y-8 md:space-y-10">
      {/* Si hay un partido en juego, manda él; si no, la presentación de los torneos */}
      <Suspense fallback={<Skeleton className="h-56 md:h-72" />}>
        <TopOfPage />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <CurrentTournaments />
      </Suspense>
      <Suspense fallback={<HomeSkeleton />}>
        <HomeMatches />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-44" />}>
        <UpcomingTournament />
      </Suspense>
    </div>
  );
}

/** El partido en vivo si lo hay; si no, los torneos en curso. */
async function TopOfPage() {
  const tournaments = await getCurrentTournaments();
  if (!tournaments.length) return <TournamentsHero tournaments={[]} />;

  const [{ live }, categories] = await Promise.all([
    getHomeMatches(tournaments.map((t) => t.id)),
    getCategories(),
  ]);
  if (!live.length) return <TournamentsHero tournaments={tournaments} />;

  // El <LiveRefresher> de HomeMatches ya refresca toda la página: montar otro
  // aquí intentaría suscribirse dos veces al mismo canal de Realtime y falla.
  const [first, ...others] = live;
  return (
    <LiveHero
      match={first}
      others={others}
      category={categories.find((c) => c.id === first.categoryId)}
      tournament={tournaments.find((t) => t.id === first.tournamentId)}
    />
  );
}

function TournamentsHero({ tournaments }: { tournaments: Tournament[] }) {
  return (
    <section className="bg-brand-gradient relative overflow-hidden rounded-3xl border border-gold/25 p-6 text-white md:p-10">
      <div aria-hidden className="absolute -right-10 -bottom-16 size-48 rounded-full bg-white/10 md:size-72" />
      <div aria-hidden className="absolute top-6 right-6 h-1.5 w-16 rounded-full bg-gold md:w-24" />
      <p className="text-sm font-medium tracking-wide text-gold uppercase">Ligas infantiles de fútbol</p>
      <h1 className="mt-1 font-display text-3xl tracking-wide uppercase md:text-5xl">Panama Global Sports</h1>
      {/* Pueden estar varios torneos en curso a la vez (Academias y Escolares) */}
      {tournaments.length ? (
        <ul className="mt-3 space-y-1 text-sm text-white/90 md:text-base">
          {tournaments.map((t) => (
            <li key={t.id}>
              {t.leagueName} · {t.name}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-5 flex gap-3">
        <Link href="/calendario" className="flex h-11 items-center gap-2 rounded-xl bg-gold px-4 text-sm font-bold text-navy">
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
  const tournaments = await getCurrentTournaments();
  if (!tournaments.length) return <EmptyState>No hay ningún torneo en curso.</EmptyState>;
  const ids = tournaments.map((t) => t.id);
  const [{ upcoming, recent }, categories, mvp] = await Promise.all([
    getHomeMatches(ids),
    getCategories(),
    getWeekMvp(ids),
  ]);
  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <>
      {/* Tiempo real en Inicio: espera unos segundos para agrupar cambios de muchos partidos.
          Los partidos en vivo ya los encabeza <LiveHero>, no se repiten aquí. */}
      <LiveRefresher delayMs={5000} />

      {/* Móvil: una columna. Desktop: resultados y el destacado lado a lado.
          Son cuatro resultados a propósito: es lo que hace que la columna
          termine a la misma altura que la tarjeta del MVP, como en el diseño.
          Sin MVP no hay con qué emparejar, así que los resultados van anchos. */}
      <div className={`grid gap-8 ${mvp ? "md:grid-cols-2" : ""}`}>
        <Section title="Últimos resultados" href="/calendario">
          {recent.length ? (
            <ResultGrid matches={recent.slice(0, 4)} catById={catById} />
          ) : (
            <EmptyState>Aún no hay resultados.</EmptyState>
          )}
        </Section>
        {mvp ? <WeekMvpCard mvp={mvp} /> : null}
      </div>

      <Section title="Próximos partidos" href="/calendario">
        {upcoming.length ? <CardGrid matches={upcoming} catById={catById} /> : <EmptyState>No hay partidos programados.</EmptyState>}
      </Section>
    </>
  );
}

/** Una tarjeta por liga con su torneo actual, sus jornadas y sus categorías. */
async function CurrentTournaments() {
  const tournaments = await getCurrentTournaments();
  if (!tournaments.length) return null;
  const ids = tournaments.map((t) => t.id);
  const [categoriesByTournament, progress] = await Promise.all([
    getCategoriesByTournament(ids),
    getTournamentProgress(ids),
  ]);
  return (
    <Section title="Torneos en curso" href="/ligas" linkLabel="Ver todos">
      <TournamentCards
        tournaments={tournaments}
        categoriesByTournament={categoriesByTournament}
        progress={progress}
      />
    </Section>
  );
}

/** El torneo que viene, mientras tenga inscripciones abiertas. */
async function UpcomingTournament() {
  const abiertos = (await getTournaments()).filter((t) => t.status === "inscripciones");
  if (!abiertos.length) return null;
  return <UpcomingBanner tournaments={abiertos} />;
}

/** Los resultados de la portada: una línea por partido, como en el diseño. */
function ResultGrid({ matches, catById }: { matches: Match[]; catById: Map<string, Category> }) {
  return (
    <ul className="grid gap-3">
      {matches.map((m) => (
        <li key={m.id}>
          <ResultCard match={m} category={catById.get(m.categoryId)} />
        </li>
      ))}
    </ul>
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


function HomeSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Skeleton className="h-80" />
      <Skeleton className="h-80" />
    </div>
  );
}
