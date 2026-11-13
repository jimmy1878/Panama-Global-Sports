import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageTitle, Skeleton } from "@/components/ui/section";
import { CategoryPicker } from "@/features/league/components/category-picker";
import { MatchList } from "@/features/league/components/match-list";
import { getCategories, getCurrentSeason, getMatches, resolveCategory, type Match } from "@/features/league/data";
import { formatLongDay } from "@/lib/format";

export const metadata: Metadata = { title: "Calendario" };

export default function CalendarioPage({ searchParams }: PageProps<"/calendario">) {
  return (
    <div>
      <PageTitle title="Calendario" subtitle="Partidos y resultados por categoría." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        {searchParams.then((sp) => (
          <CalendarContent cat={sp.cat} />
        ))}
      </Suspense>
    </div>
  );
}

async function CalendarContent({ cat }: { cat: string | string[] | undefined }) {
  const [season, categories, category] = await Promise.all([getCurrentSeason(), getCategories(), resolveCategory(cat)]);
  if (!season || !category) return <EmptyState>No hay una temporada activa.</EmptyState>;

  const matches = await getMatches({ seasonId: season.id, categoryId: category.id });

  // Agrupar por jornada (o por día si no tiene jornada)
  const groups = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.matchday ? `J${m.matchday}` : m.startsAt.slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }

  return (
    <>
      <CategoryPicker categories={categories} current={category} basePath="/calendario" />
      <h2 className="mb-4 text-sm text-muted">
        <strong className="text-foreground">
          {category.leagueName} · {category.code}
        </strong>{" "}
        · {season.name}
      </h2>
      {groups.size === 0 ? (
        <EmptyState>Todavía no hay partidos en esta categoría.</EmptyState>
      ) : (
        <div className="space-y-8">
          {[...groups.values()].map((group) => {
            const first = group[0];
            const done = group.every((m) => m.status === "finished");
            return (
              <section key={first.id}>
                <h3 className="mb-3 flex flex-wrap items-baseline gap-x-2 font-bold">
                  {first.matchday ? `Jornada ${first.matchday}` : "Partidos"}
                  <span className="text-sm font-normal text-muted">{formatLongDay(first.startsAt)}</span>
                  {done ? <span className="text-xs font-medium text-muted">· Jugada</span> : null}
                </h3>
                <MatchList matches={group} />
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
