import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, UserX } from "lucide-react";
import { EmptyState, PageTitle, Section, Skeleton } from "@/components/ui/section";
import { getAssignedMatchIds, getVenues } from "@/features/admin/data";
import { AdminForm, Field, Select, TextInput } from "@/features/admin/form";
import { TeamSelect } from "@/features/admin/team-select";
import { CategoryPicker } from "@/features/league/components/category-picker";
import { StatusBadge } from "@/features/league/components/match-list";
import { getCategories, getCurrentSeason, getMatches, getTeams, resolveCategory } from "@/features/league/data";
import { formatDay, formatTime } from "@/lib/format";
import { createMatch } from "./actions";

export const metadata: Metadata = { title: "Partidos" };

export default function MatchesAdminPage({ searchParams }: PageProps<"/admin/partidos">) {
  return (
    <div>
      <PageTitle title="Partidos" subtitle="Programa partidos y asigna delegados o árbitros." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        {searchParams.then((sp) => (
          <MatchesAdmin cat={sp.cat} />
        ))}
      </Suspense>
    </div>
  );
}

async function MatchesAdmin({ cat }: { cat: string | string[] | undefined }) {
  const [season, categories, category] = await Promise.all([getCurrentSeason(), getCategories(), resolveCategory(cat)]);
  if (!season || !category) return <EmptyState>Primero marca una temporada como actual.</EmptyState>;

  const [matches, teams, venues, officials] = await Promise.all([
    getMatches({ seasonId: season.id, categoryId: category.id }),
    getTeams(season.id).then((all) => all.filter((t) => t.categoryId === category.id)),
    getVenues(),
    getAssignedMatchIds(),
  ]);

  return (
    <>
      <CategoryPicker categories={categories} current={category} basePath="/admin/partidos" />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <Section title={`${category.leagueName} · ${category.code} (${matches.length})`}>
          {matches.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {matches.map((m) => (
                <li key={m.id}>
                  <Link href={`/admin/partidos/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted">
                    <span className="w-20 shrink-0 text-xs text-muted">
                      {formatDay(m.startsAt)}
                      <br />
                      {formatTime(m.startsAt)}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate font-medium">
                        {m.home.name} {m.homeScore !== null ? `${m.homeScore} – ${m.awayScore}` : "vs"} {m.away.name}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        {m.matchday ? `J${m.matchday}` : ""} {m.venue ? `· ${m.venue}` : ""}
                        {m.status === "scheduled" && !officials.has(m.id) ? (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <UserX className="size-3.5" aria-hidden />
                            sin delegado
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <StatusBadge match={m} />
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Todavía no hay partidos en esta categoría.</EmptyState>
          )}
        </Section>

        <Section title="Nuevo partido">
          <div className="rounded-2xl border border-border bg-surface p-4">
            {teams.length < 2 ? (
              <p className="text-sm text-muted">Esta categoría necesita al menos 2 equipos.</p>
            ) : (
              <AdminForm action={createMatch} submitLabel="Programar partido" resetOnSuccess>
                <input type="hidden" name="season_id" value={season.id} />
                <input type="hidden" name="category_id" value={category.id} />
                <div className="grid grid-cols-2 gap-3">
                  <Field name="date" label="Fecha">
                    <TextInput name="date" type="date" required />
                  </Field>
                  <Field name="time" label="Hora">
                    <TextInput name="time" type="time" required defaultValue="08:00" />
                  </Field>
                </div>
                <TeamSelect name="home_team_id" label="Local" teams={teams} />
                <TeamSelect name="away_team_id" label="Visitante" teams={teams} />
                <div className="grid grid-cols-2 gap-3">
                  <Field name="venue_id" label="Cancha">
                    <Select name="venue_id" defaultValue="">
                      <option value="">Por definir</option>
                      {venues.filter((v) => v.is_active).map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field name="matchday" label="Jornada">
                    <TextInput name="matchday" type="number" min={1} max={99} />
                  </Field>
                </div>
              </AdminForm>
            )}
            <p className="mt-3 text-xs text-muted">La hora es la de Panamá.</p>
          </div>
        </Section>
      </div>
    </>
  );
}
