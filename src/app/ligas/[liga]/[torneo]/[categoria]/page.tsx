import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, Section, Skeleton } from "@/components/ui/section";
import { LiveRefresher } from "@/components/live/live-refresher";
import { CategoryHeader } from "@/features/league/components/category-header";
import { LeaderBoards, TeamStars } from "@/features/league/components/leaders";
import { LeadersCard, TeamStarsCard } from "@/features/league/components/leaders-card";
import { MatchList } from "@/features/league/components/match-list";
import { MatchdayList } from "@/features/league/components/matchday-list";
import { StandingsTable } from "@/features/league/components/standings";
import { TeamGrid } from "@/features/league/components/team-grid";
import {
  getLeaders,
  getMatches,
  getRecentForm,
  getStandings,
  getTeamRecognitions,
  resolveCategoryRoute,
  type Category,
  type Match,
  type Tournament,
} from "@/features/league/data";
import { resolveView, type CategoryView } from "@/features/league/paths";

/**
 * La pantalla central de la liga: una categoría dentro de un torneo.
 *
 * La URL es la que lee una familia —/ligas/boys/academias-clausura-2026/u10—
 * y las pestañas (?v=) cambian de sección sin salir de ella.
 */
export async function generateMetadata({
  params,
}: PageProps<"/ligas/[liga]/[torneo]/[categoria]">): Promise<Metadata> {
  const { liga, torneo, categoria } = await params;
  const resolved = await resolveCategoryRoute(liga, torneo, categoria);
  if (!resolved) return { title: "Categoría" };
  return {
    title: `${resolved.category.code} · ${resolved.tournament.name}`,
    description: `Tabla de posiciones, calendario y líderes de ${resolved.category.code} en ${resolved.tournament.name} (${resolved.category.leagueName}).`,
  };
}

export default function CategoriaPage({
  params,
  searchParams,
}: PageProps<"/ligas/[liga]/[torneo]/[categoria]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      {Promise.all([params, searchParams]).then(([p, sp]) => (
        <CategoryScreen liga={p.liga} torneo={p.torneo} categoria={p.categoria} view={resolveView(sp.v)} />
      ))}
    </Suspense>
  );
}

async function CategoryScreen({
  liga,
  torneo,
  categoria,
  view,
}: {
  liga: string;
  torneo: string;
  categoria: string;
  view: CategoryView;
}) {
  const resolved = await resolveCategoryRoute(liga, torneo, categoria);
  if (!resolved) notFound();
  const { category, tournament, tournaments } = resolved;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Un marcador en vivo de la categoría refresca la pantalla sola */}
      <LiveRefresher delayMs={5000} />
      <CategoryHeader category={category} tournament={tournament} tournaments={tournaments} view={view} />
      <ViewContent view={view} category={category} tournament={tournament} />
    </div>
  );
}

function ViewContent(props: { view: CategoryView; category: Category; tournament: Tournament }) {
  switch (props.view) {
    case "calendario":
      return <CalendarView {...props} />;
    case "resultados":
      return <ResultsView {...props} />;
    case "lideres":
      return <LeadersView {...props} />;
    case "equipos":
      return <TeamsView {...props} />;
    default:
      return <TableView {...props} />;
  }
}

type ViewProps = { category: Category; tournament: Tournament };

/** Tabla de posiciones + líderes + la jornada que viene: la portada de la categoría. */
async function TableView({ category, tournament }: ViewProps) {
  const individual = category.recognitionMode === "individual_ranking";
  const [standings, form, matches, leaders, recognitions] = await Promise.all([
    getStandings(tournament.id, category.id),
    getRecentForm(tournament.id, category.id),
    getMatches({ tournamentId: tournament.id, categoryId: category.id }),
    individual ? getLeaders(tournament.id, category.id) : Promise.resolve({}),
    individual ? Promise.resolve([]) : getTeamRecognitions(tournament.id, category.id),
  ]);

  const next = nextMatchday(matches);

  return (
    <div className="space-y-8">
      <Section title="Tabla de posiciones">
        {standings.length ? (
          <StandingsTable rows={standings} form={form} />
        ) : (
          <EmptyState>Todavía no hay equipos en esta categoría.</EmptyState>
        )}
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        {individual ? (
          <LeadersCard leaders={leaders} category={category} tournament={tournament} />
        ) : (
          <TeamStarsCard rows={recognitions} category={category} tournament={tournament} />
        )}
        {next.length ? (
          <Section title={next[0].matchday ? `Jornada ${next[0].matchday}` : "Próximos partidos"}>
            <MatchList matches={next} />
          </Section>
        ) : null}
      </div>
    </div>
  );
}

async function CalendarView({ category, tournament }: ViewProps) {
  const matches = await getMatches({ tournamentId: tournament.id, categoryId: category.id });
  return (
    <MatchdayList
      matches={matches.filter((m) => m.status !== "finished")}
      empty="No quedan partidos por jugar en esta categoría."
    />
  );
}

async function ResultsView({ category, tournament }: ViewProps) {
  const matches = await getMatches({ tournamentId: tournament.id, categoryId: category.id });
  const finished = matches.filter((m) => m.status === "finished").reverse();
  return <MatchdayList matches={finished} empty="Todavía no se ha jugado ningún partido." />;
}

async function LeadersView({ category, tournament }: ViewProps) {
  const individual = category.recognitionMode === "individual_ranking";
  if (!individual) {
    return (
      <Section title="Estrellas del equipo">
        <TeamStars rows={await getTeamRecognitions(tournament.id, category.id)} />
      </Section>
    );
  }
  return (
    <Section title={`Líderes · ${tournament.name}`}>
      <LeaderBoards leaders={await getLeaders(tournament.id, category.id)} />
    </Section>
  );
}

async function TeamsView({ category, tournament }: ViewProps) {
  const standings = await getStandings(tournament.id, category.id);
  return (
    <Section title={`Equipos · ${category.code}`}>
      <TeamGrid rows={standings} categoryCode={category.code} />
    </Section>
  );
}

/**
 * La próxima jornada: los partidos de la primera jornada que todavía tiene algo
 * por jugar. Si un partido está en vivo, esa es la jornada de hoy.
 */
function nextMatchday(matches: Match[]): Match[] {
  const pending = matches.filter((m) => m.status === "live" || m.status === "scheduled");
  if (!pending.length) return [];
  const first = pending.find((m) => m.status === "live") ?? pending[0];
  return pending.filter((m) => m.matchday === first.matchday);
}
