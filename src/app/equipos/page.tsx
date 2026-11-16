import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageTitle, Section, Skeleton } from "@/components/ui/section";
import { CategoryPicker } from "@/features/league/components/category-picker";
import { TeamGrid } from "@/features/league/components/team-grid";
import { getCategories, getStandings, resolveCategory, resolveTournament } from "@/features/league/data";
import { categoryPath } from "@/features/league/paths";

export const metadata: Metadata = { title: "Equipos" };

export default function EquiposPage({ searchParams }: PageProps<"/equipos">) {
  return (
    <div>
      <PageTitle title="Equipos" subtitle="Los equipos de cada categoría en el torneo en curso." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        {searchParams.then((sp) => (
          <TeamsContent cat={sp.cat} torneo={sp.torneo} />
        ))}
      </Suspense>
    </div>
  );
}

async function TeamsContent({ cat, torneo }: { cat: string | string[] | undefined; torneo: string | string[] | undefined }) {
  const [categories, category] = await Promise.all([getCategories(), resolveCategory(cat)]);
  if (!category) return <EmptyState>Todavía no hay categorías configuradas.</EmptyState>;

  const tournament = await resolveTournament(category.id, torneo);
  if (!tournament) return <EmptyState>Esta categoría todavía no juega ningún torneo.</EmptyState>;

  // La tabla de posiciones trae a todos los equipos de la categoría con su puesto.
  const teams = await getStandings(tournament.id, category.id);


  return (
    <>
      <CategoryPicker categories={categories} current={category} basePath="/equipos" />
      <Section
        title={`${category.leagueName} · ${category.code}`}
        href={categoryPath(category, tournament)}
        linkLabel="Ver la categoría"
      >
        <TeamGrid rows={teams} categoryCode={category.code} />
      </Section>
    </>
  );
}
