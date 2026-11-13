import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { EmptyState, PageTitle, Skeleton } from "@/components/ui/section";
import { TeamCrest } from "@/components/ui/team-crest";
import { CategoryPicker } from "@/features/league/components/category-picker";
import { getCategories, getCurrentSeason, getStandings, resolveCategory } from "@/features/league/data";

export const metadata: Metadata = { title: "Equipos" };

export default function EquiposPage({ searchParams }: PageProps<"/equipos">) {
  return (
    <div>
      <PageTitle title="Equipos" subtitle="Los equipos de cada categoría en la temporada actual." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        {searchParams.then((sp) => (
          <TeamsContent cat={sp.cat} />
        ))}
      </Suspense>
    </div>
  );
}

async function TeamsContent({ cat }: { cat: string | string[] | undefined }) {
  const [season, categories, category] = await Promise.all([getCurrentSeason(), getCategories(), resolveCategory(cat)]);
  if (!season || !category) return <EmptyState>No hay una temporada activa.</EmptyState>;

  // La tabla de posiciones trae a todos los equipos de la categoría con su puesto.
  const standings = await getStandings(season.id, category.id);
  const teams = [...standings].sort((a, b) => a.team.name.localeCompare(b.team.name, "es"));

  return (
    <>
      <CategoryPicker categories={categories} current={category} basePath="/equipos" />
      {teams.length === 0 ? (
        <EmptyState>Todavía no hay equipos en esta categoría.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map(({ team, position, points, played }) => (
            <li key={team.id}>
              <Link
                href={`/equipos/${team.id}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-brand-blue active:bg-surface-muted"
              >
                <TeamCrest team={team} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold">{team.name}</span>
                  <span className="block text-sm text-muted">
                    {category.code} · {position}º lugar · {points} pts
                    {played ? "" : " · sin partidos"}
                  </span>
                </span>
                <ChevronRight className="size-5 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
