import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { PageTitle, Section, Skeleton } from "@/components/ui/section";
import { getMatchAdmin, getUsers, getVenues } from "@/features/admin/data";
import { AdminForm, Field, Select, TextInput } from "@/features/admin/form";
import { TeamSelect } from "@/features/admin/team-select";
import { getCategories, getTeams, isUuid } from "@/features/league/data";
import { assignOfficial, deleteMatch, removeOfficial, updateMatch } from "../actions";

export const metadata: Metadata = { title: "Editar partido" };

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Programado" },
  { value: "postponed", label: "Aplazado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "finished", label: "Finalizado (resultado manual)" },
];

/** ISO → fecha y hora en Panamá para los inputs. */
function toPanamaInputs(iso: string) {
  const d = new Date(new Date(iso).getTime() - 5 * 60 * 60 * 1000);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}

export default function MatchAdminPage({ params }: PageProps<"/admin/partidos/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem]" />}>
      {params.then(({ id }) => (
        <MatchAdmin id={id} />
      ))}
    </Suspense>
  );
}

async function MatchAdmin({ id }: { id: string }) {
  if (!isUuid(id)) notFound();
  const match = await getMatchAdmin(id);
  if (!match) notFound();

  const [categories, allTeams, venues, users] = await Promise.all([
    getCategories(),
    getTeams(match.season_id),
    getVenues(),
    getUsers(),
  ]);
  const category = categories.find((c) => c.id === match.category_id);
  const teams = allTeams.filter((t) => t.categoryId === match.category_id);
  const teamName = (tid: string) => teams.find((t) => t.id === tid)?.name ?? "Equipo";
  const back = `/admin/partidos?cat=${category?.key ?? ""}`;
  const { date, time } = toPanamaInputs(match.starts_at);
  const live = match.status === "live";

  const userById = new Map(users.map((u) => [u.id, u]));
  const assigned = new Set(match.match_officials.map((o) => o.user_id));
  const delegates = users.filter((u) => u.role === "delegate" && !assigned.has(u.id));

  return (
    <div className="space-y-8">
      <Link href={back} className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue">
        <ChevronLeft className="size-4" aria-hidden />
        Partidos {category?.code}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle
          title={`${teamName(match.home_team_id)} vs ${teamName(match.away_team_id)}`}
          subtitle={category ? `${category.leagueName} · ${category.code}` : undefined}
        />
        <Link href={`/partidos/${match.id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-blue md:mb-6">
          Ver página pública
          <ExternalLink className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <Section title="Datos del partido">
          <div className="rounded-2xl border border-border bg-surface p-4">
            {live ? (
              <p className="mb-4 rounded-xl bg-brand-red/10 p-3 text-sm text-brand-red">
                El partido está EN VIVO: el marcador lo controla el delegado. Aquí solo puedes forzar el final.
              </p>
            ) : null}
            <AdminForm action={updateMatch}>
              <input type="hidden" name="id" value={match.id} />
              <div className="grid grid-cols-2 gap-3">
                <Field name="date" label="Fecha">
                  <TextInput name="date" type="date" defaultValue={date} required />
                </Field>
                <Field name="time" label="Hora (Panamá)">
                  <TextInput name="time" type="time" defaultValue={time} required />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TeamSelect name="home_team_id" label="Local" teams={teams} defaultValue={match.home_team_id} />
                <TeamSelect name="away_team_id" label="Visitante" teams={teams} defaultValue={match.away_team_id} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field name="venue_id" label="Cancha">
                  <Select name="venue_id" defaultValue={match.venue_id ?? ""}>
                    <option value="">Por definir</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field name="matchday" label="Jornada">
                  <TextInput name="matchday" type="number" min={1} max={99} defaultValue={match.matchday ?? ""} />
                </Field>
              </div>
              <Field name="status" label="Estado">
                <Select name="status" defaultValue={live ? "finished" : match.status}>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field name="home_score" label="Goles local" hint="Solo si está finalizado">
                  <TextInput name="home_score" type="number" min={0} max={99} defaultValue={match.home_score ?? ""} />
                </Field>
                <Field name="away_score" label="Goles visitante">
                  <TextInput name="away_score" type="number" min={0} max={99} defaultValue={match.away_score ?? ""} />
                </Field>
              </div>
              <Field name="notes" label="Notas internas">
                <TextInput name="notes" defaultValue={match.notes ?? ""} maxLength={500} />
              </Field>
            </AdminForm>
            <p className="mt-3 text-xs text-muted">
              Lo normal es que el resultado lo cargue el delegado en vivo (con goleadores). El resultado manual no registra
              goleadores.
            </p>
          </div>
        </Section>

        <div className="space-y-8">
          <Section title="Delegados y árbitros">
            <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
              {match.match_officials.length ? (
                <ul className="space-y-2">
                  {match.match_officials.map((o) => {
                    const u = userById.get(o.user_id);
                    return (
                      <li key={o.user_id} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{u?.full_name || u?.email || "Usuario"}</span>
                          <span className="block text-xs text-muted">{o.role === "referee" ? "Árbitro" : "Delegado"}</span>
                        </span>
                        <AdminForm action={removeOfficial} submitLabel="Quitar" compact danger className="contents">
                          <input type="hidden" name="match_id" value={match.id} />
                          <input type="hidden" name="user_id" value={o.user_id} />
                        </AdminForm>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-amber-700">Sin asignar: nadie podrá cargar este partido en vivo.</p>
              )}
              {delegates.length ? (
                <AdminForm action={assignOfficial} submitLabel="Asignar" resetOnSuccess>
                  <input type="hidden" name="match_id" value={match.id} />
                  <Field name="user_id" label="Usuario con rol delegado">
                    <Select name="user_id" defaultValue="" required>
                      <option value="" disabled>
                        Elige…
                      </option>
                      {delegates.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name || u.email}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field name="role" label="Función">
                    <Select name="role" defaultValue="delegate">
                      <option value="delegate">Delegado</option>
                      <option value="referee">Árbitro</option>
                    </Select>
                  </Field>
                </AdminForm>
              ) : (
                <p className="text-xs text-muted">
                  No hay más usuarios con rol delegado. Asigna el rol en{" "}
                  <Link href="/admin/usuarios" className="font-medium text-brand-blue">
                    Usuarios y roles
                  </Link>
                  .
                </p>
              )}
            </div>
          </Section>

          <Section title="Eliminar partido">
            <div className="rounded-2xl border border-brand-red/30 bg-surface p-4">
              <p className="mb-3 text-sm text-muted">Borra también sus eventos, MVP y votos.</p>
              <AdminForm action={deleteMatch} submitLabel="Eliminar partido" danger confirm="¿Eliminar este partido y todos sus datos?">
                <input type="hidden" name="id" value={match.id} />
                <input type="hidden" name="back" value={back} />
              </AdminForm>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
