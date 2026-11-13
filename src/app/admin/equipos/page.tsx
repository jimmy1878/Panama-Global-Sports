import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { EmptyState, PageTitle, Section, Skeleton } from "@/components/ui/section";
import { TeamCrest } from "@/components/ui/team-crest";
import { AdminForm, Field, TextInput } from "@/features/admin/form";
import { CategoryPicker } from "@/features/league/components/category-picker";
import { getCategories, getCurrentSeason, getTeams, resolveCategory } from "@/features/league/data";
import { createTeam } from "./actions";

export const metadata: Metadata = { title: "Equipos y jugadores" };

export default function TeamsAdminPage({ searchParams }: PageProps<"/admin/equipos">) {
  return (
    <div>
      <PageTitle title="Equipos y jugadores" subtitle="Elige una categoría. Entra a un equipo para editar su plantel." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        {searchParams.then((sp) => (
          <TeamsAdmin cat={sp.cat} />
        ))}
      </Suspense>
    </div>
  );
}

async function TeamsAdmin({ cat }: { cat: string | string[] | undefined }) {
  const [season, categories, category] = await Promise.all([getCurrentSeason(), getCategories(), resolveCategory(cat)]);
  if (!season || !category) return <EmptyState>Primero marca una temporada como actual.</EmptyState>;
  const teams = (await getTeams(season.id)).filter((t) => t.categoryId === category.id);

  return (
    <>
      <CategoryPicker categories={categories} current={category} basePath="/admin/equipos" />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <Section title={`${category.leagueName} · ${category.code} (${teams.length})`}>
          {teams.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {teams.map((team) => (
                <li key={team.id}>
                  <Link
                    href={`/admin/equipos/${team.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-brand-blue"
                  >
                    <TeamCrest team={team} />
                    <span className="flex-1 truncate font-semibold">{team.name}</span>
                    <ChevronRight className="size-4 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Todavía no hay equipos en esta categoría.</EmptyState>
          )}
        </Section>

        <Section title="Nuevo equipo">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <AdminForm action={createTeam} submitLabel="Crear equipo" resetOnSuccess>
              <input type="hidden" name="season_id" value={season.id} />
              <input type="hidden" name="category_id" value={category.id} />
              <input type="hidden" name="category_code" value={category.code} />
              <Field name="name" label="Nombre">
                <TextInput name="name" required placeholder="Tiburones FC" />
              </Field>
              <Field name="short_name" label="Abreviatura" hint="2 a 4 letras, p. ej. TIB">
                <TextInput name="short_name" required maxLength={4} className="uppercase" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field name="primary_color" label="Color principal">
                  <TextInput name="primary_color" type="color" defaultValue="#005293" className="p-1" />
                </Field>
                <Field name="secondary_color" label="Color secundario">
                  <TextInput name="secondary_color" type="color" defaultValue="#ffffff" className="p-1" />
                </Field>
              </div>
            </AdminForm>
            <p className="mt-3 text-xs text-muted">El logo se sube después, al editar el equipo.</p>
          </div>
        </Section>
      </div>
    </>
  );
}
