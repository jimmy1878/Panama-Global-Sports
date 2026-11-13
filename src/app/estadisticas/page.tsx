import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageTitle, Section, Skeleton } from "@/components/ui/section";
import { CategoryPicker } from "@/features/league/components/category-picker";
import { LeaderBoards, TeamStars } from "@/features/league/components/leaders";
import { StandingsTable } from "@/features/league/components/standings";
import {
  getCategories,
  getCurrentSeason,
  getLeaders,
  getStandings,
  getTeamRecognitions,
  resolveCategory,
} from "@/features/league/data";

export const metadata: Metadata = { title: "Estadísticas" };

export default function EstadisticasPage({ searchParams }: PageProps<"/estadisticas">) {
  return (
    <div>
      <PageTitle title="Estadísticas" subtitle="Tabla de posiciones y líderes de la temporada." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        {searchParams.then((sp) => (
          <StatsContent cat={sp.cat} />
        ))}
      </Suspense>
    </div>
  );
}

async function StatsContent({ cat }: { cat: string | string[] | undefined }) {
  const [season, categories, category] = await Promise.all([getCurrentSeason(), getCategories(), resolveCategory(cat)]);
  if (!season || !category) return <EmptyState>No hay una temporada activa.</EmptyState>;

  const individual = category.recognitionMode === "individual_ranking";
  const [standings, leaders, recognitions] = await Promise.all([
    getStandings(season.id, category.id),
    individual ? getLeaders(season.id, category.id) : Promise.resolve({}),
    individual ? Promise.resolve([]) : getTeamRecognitions(season.id, category.id),
  ]);

  return (
    <>
      <CategoryPicker categories={categories} current={category} basePath="/estadisticas" />
      {/* Desktop: posiciones a la izquierda, líderes debajo a lo ancho; móvil: una columna. */}
      <div className="space-y-8">
        <Section title={`Posiciones · ${category.leagueName} ${category.code}`}>
          {standings.length ? <StandingsTable rows={standings} /> : <EmptyState>Sin equipos todavía.</EmptyState>}
        </Section>
        {individual ? (
          <Section title="Líderes de la temporada">
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
