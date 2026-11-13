import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageTitle, Section, Skeleton } from "@/components/ui/section";
import { TeamCrest } from "@/components/ui/team-crest";
import { POSITIONS } from "@/features/admin/constants";
import { AdminForm, Field, Select, TextInput } from "@/features/admin/form";
import { getCategories, getTeamDetail, isUuid } from "@/features/league/data";
import { addPlayer, deleteTeam, updateTeam } from "../actions";

export const metadata: Metadata = { title: "Editar equipo" };



export default function TeamAdminPage({ params }: PageProps<"/admin/equipos/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem]" />}>
      {params.then(({ id }) => (
        <TeamAdmin id={id} />
      ))}
    </Suspense>
  );
}

async function TeamAdmin({ id }: { id: string }) {
  if (!isUuid(id)) notFound();
  const [detail, categories] = await Promise.all([getTeamDetail(id), getCategories()]);
  if (!detail) notFound();
  const { team, seasonId, players } = detail;
  const category = categories.find((c) => c.id === team.categoryId);
  const back = `/admin/equipos?cat=${category?.key ?? ""}`;

  return (
    <div className="space-y-8">
      <Link href={back} className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue">
        <ChevronLeft className="size-4" aria-hidden />
        Equipos {category?.code}
      </Link>
      <div className="flex items-center gap-4">
        <TeamCrest team={team} size="lg" />
        <PageTitle title={team.name} subtitle={category ? `${category.leagueName} · ${category.code}` : undefined} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        {/* Plantel */}
        <div className="space-y-8">
          <Section title={`Plantel (${players.length})`}>
            {players.length ? (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {players.map((p) => (
                  <li key={p.playerId}>
                    <Link
                      href={`/admin/jugadores/${p.playerId}?equipo=${team.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted"
                    >
                      <span className="grid size-9 place-items-center rounded-full bg-surface-muted text-sm font-black tabular-nums">
                        {p.jerseyNumber}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.displayName}</span>
                        <span className="block text-xs text-muted">{p.position ?? "Sin posición"}</span>
                      </span>
                      <ChevronRight className="size-4 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Aún no hay jugadores. Agrega el primero.</p>
            )}
          </Section>

          <Section title="Agregar jugador">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <AdminForm action={addPlayer} submitLabel="Agregar al plantel" resetOnSuccess>
                <input type="hidden" name="team_id" value={team.id} />
                <input type="hidden" name="season_id" value={seasonId} />
                <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
                  <Field name="first_name" label="Nombre">
                    <TextInput name="first_name" required autoComplete="off" placeholder="Mateo" />
                  </Field>
                  <Field name="last_initial" label="Inicial" hint="Solo la letra">
                    <TextInput name="last_initial" required maxLength={1} className="uppercase" placeholder="R" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field name="jersey_number" label="Número">
                    <TextInput name="jersey_number" type="number" inputMode="numeric" min={0} max={99} required />
                  </Field>
                  <Field name="position" label="Posición">
                    <Select name="position" defaultValue="">
                      <option value="">—</option>
                      {POSITIONS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </AdminForm>
              <p className="mt-3 text-xs text-muted">
                Por privacidad solo guardamos nombre e inicial del apellido. Nunca fecha de nacimiento, colegio ni contacto.
              </p>
            </div>
          </Section>
        </div>

        {/* Datos del equipo */}
        <div className="space-y-8">
          <Section title="Datos del equipo">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <AdminForm action={updateTeam}>
                <input type="hidden" name="id" value={team.id} />
                <Field name="name" label="Nombre">
                  <TextInput name="name" defaultValue={team.name} required />
                </Field>
                <Field name="short_name" label="Abreviatura">
                  <TextInput name="short_name" defaultValue={team.shortName ?? ""} required maxLength={4} className="uppercase" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field name="primary_color" label="Principal">
                    <TextInput name="primary_color" type="color" defaultValue={team.primaryColor} className="p-1" />
                  </Field>
                  <Field name="secondary_color" label="Secundario">
                    <TextInput name="secondary_color" type="color" defaultValue={team.secondaryColor} className="p-1" />
                  </Field>
                </div>
                <Field name="logo" label="Logo" hint="PNG con fondo transparente, ideal. Se ajusta a 512 px.">
                  <TextInput name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="h-auto py-2" />
                </Field>
              </AdminForm>
            </div>
          </Section>

          <Section title="Eliminar equipo">
            <div className="rounded-2xl border border-brand-red/30 bg-surface p-4">
              <p className="mb-3 text-sm text-muted">Solo es posible si el equipo no tiene partidos.</p>
              <AdminForm
                action={deleteTeam}
                submitLabel="Eliminar equipo"
                danger
                confirm={`¿Eliminar ${team.name} y su plantel? No se puede deshacer.`}
              >
                <input type="hidden" name="id" value={team.id} />
                <input type="hidden" name="back" value={back} />
              </AdminForm>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
