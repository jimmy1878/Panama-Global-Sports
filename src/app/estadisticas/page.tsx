import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageTitle, Section, Skeleton } from "@/components/ui/section";
import { CategoryPicker } from "@/features/league/components/category-picker";
import { LeaderBoards, TeamStars } from "@/features/league/components/leaders";
import { StandingsTable } from "@/features/league/components/standings";
import {
  getCategories,
  getLeaders,
  getRecentForm,
  getStandings,
  getTeamRecognitions,
  resolveCategory,
  resolveTournament,
} from "@/features/league/data";
import { categoryPath } from "@/features/league/paths";

export const metadata: Metadata = { title: "Estadísticas" };

export default function EstadisticasPage({ searchParams }: PageProps<"/estadisticas">) {
  return (
    <div>
      <PageTitle title="Estadísticas" subtitle="Tabla de posiciones y líderes del torneo." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        {searchParams.then((sp) => (
          <StatsContent cat={sp.cat} torneo={sp.torneo} />
        ))}
      </Suspense>
    </div>
  );
}

async function StatsContent({ cat, torneo }: { cat: string | string[] | undefined; torneo: string | string[] | undefined }) {
  const [categories, category] = await Promise.all([getCategories(), resolveCategory(cat)]);
  if (!category) return <EmptyState>Todavía no hay categorías configuradas.</EmptyState>;

  const tournament = await resolveTournament(category.id, torneo);
  if (!tournament) return <EmptyState>Esta categoría todavía no juega ningún torneo.</EmptyState>;

  const individual = category.recognitionMode === "individual_ranking";
  const [standings, form, leaders, recognitions] = await Promise.all([
    getStandings(tournament.id, category.id),
    getRecentForm(tournament.id, category.id),
    individual ? getLeaders(tournament.id, category.id) : Promise.resolve({}),
    individual ? Promise.resolve([]) : getTeamRecognitions(tournament.id, category.id),
  ]);

  return (
    <>
      <CategoryPicker categories={categories} current={category} basePath="/estadisticas" />
      {/* Desktop: posiciones a la izquierda, líderes debajo a lo ancho; móvil: una columna. */}
      <div className="space-y-8">
        <Section
          title={`Posiciones · ${category.leagueName} ${category.code}`}
          href={categoryPath(category, tournament)}
          linkLabel="Ver la categoría"
        >
          {standings.length ? (
            <StandingsTable rows={standings} form={form} />
          ) : (
            <EmptyState>Sin equipos todavía.</EmptyState>
          )}
        </Section>
        {individual ? (
          <Section title="Líderes del torneo">
            <LeaderBoards leaders={leaders} />
          </Section>
        ) : (
          <Section title="Estrellas del equipo">
            <TeamStars rows={recognitions} />
          </Section>
        )}
      </div>
    </>
  );
}
