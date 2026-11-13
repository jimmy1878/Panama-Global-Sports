import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { PageTitle, Section, Skeleton } from "@/components/ui/section";
import { RELATIONSHIPS } from "@/features/admin/constants";
import { getFamily, getUsers, searchPlayers } from "@/features/admin/data";
import { AdminForm, Field, Select, TextInput } from "@/features/admin/form";
import { getCurrentSeason, isUuid } from "@/features/league/data";
import { addMember, deleteFamily, linkChild, removeMember, renameFamily, unlinkChild } from "../actions";

export const metadata: Metadata = { title: "Familia" };

export default function FamilyAdminPage({ params, searchParams }: PageProps<"/admin/familias/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem]" />}>
      {Promise.all([params, searchParams]).then(([{ id }, sp]) => (
        <FamilyAdmin id={id} q={typeof sp.q === "string" ? sp.q.trim() : ""} />
      ))}
    </Suspense>
  );
}

async function FamilyAdmin({ id, q }: { id: string; q: string }) {
  if (!isUuid(id)) notFound();
  const [family, users, season] = await Promise.all([getFamily(id), getUsers(), getCurrentSeason()]);
  if (!family) notFound();

  const userById = new Map(users.map((u) => [u.id, u]));
  const linked = new Set(family.family_players.flatMap((fp) => (fp.player ? [fp.player.id] : [])));
  const results = q.length >= 2 && season ? (await searchPlayers(season.id, q)).filter((r) => !linked.has(r.player_id)) : [];
  const relLabel = (r: string | null) => RELATIONSHIPS.find((x) => x.value === r)?.label ?? "Adulto";

  return (
    <div className="space-y-8">
      <Link href="/admin/familias" className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue">
        <ChevronLeft className="size-4" aria-hidden />
        Familias
      </Link>
      <PageTitle title={family.name} />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Adultos */}
        <Section title={`Adultos (${family.family_members.length})`}>
          <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
            {family.family_members.length ? (
              <ul className="space-y-2">
                {family.family_members.map((m) => {
                  const u = userById.get(m.user_id);
                  return (
                    <li key={m.user_id} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{u?.email ?? "Cuenta"}</span>
                        <span className="block text-xs text-muted">{relLabel(m.relationship)}</span>
                      </span>
                      <AdminForm action={removeMember} submitLabel="Quitar" compact danger className="contents">
                        <input type="hidden" name="family_id" value={family.id} />
                        <input type="hidden" name="user_id" value={m.user_id} />
                      </AdminForm>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">Sin adultos todavía.</p>
            )}
            <AdminForm action={addMember} submitLabel="Vincular adulto" resetOnSuccess>
              <input type="hidden" name="family_id" value={family.id} />
              <Field name="email" label="Correo de su cuenta" hint="La persona debe haber ingresado a la app al menos una vez.">
                <TextInput name="email" type="email" inputMode="email" required autoComplete="off" />
              </Field>
              <Field name="relationship" label="Parentesco">
                <Select name="relationship" defaultValue="madre">
                  {RELATIONSHIPS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </AdminForm>
          </div>
        </Section>

        {/* Hijos */}
        <Section title={`Hijos (${family.family_players.length})`}>
          <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
            {family.family_players.length ? (
              <ul className="space-y-2">
                {family.family_players.flatMap((fp) => {
                  const p = fp.player;
                  if (!p) return [];
                  const current = p.roster_entries.find((r) => r.team?.season_id === season?.id);
                  return [
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <Link href={`/admin/jugadores/${p.id}`} className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-brand-blue">{p.display_name}</span>
                        <span className="block text-xs text-muted">
                          {current ? `${current.team?.name} · #${current.jersey_number}` : "Sin equipo esta temporada"}
                        </span>
                      </Link>
                      <AdminForm action={unlinkChild} submitLabel="Quitar" compact danger className="contents">
                        <input type="hidden" name="family_id" value={family.id} />
                        <input type="hidden" name="player_id" value={p.id} />
                      </AdminForm>
                    </li>,
                  ];
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">Sin hijos vinculados todavía.</p>
            )}

            {/* Búsqueda: formulario GET normal (funciona sin JavaScript) */}
            <form method="get" className="flex gap-2">
              <label className="sr-only" htmlFor="q">
                Buscar jugador por nombre
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Buscar jugador por nombre…"
                className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-base md:text-sm"
              />
              <button type="submit" className="grid size-11 place-items-center rounded-xl bg-brand-blue text-white" aria-label="Buscar">
                <Search className="size-5" aria-hidden />
              </button>
            </form>
            {q.length >= 2 ? (
              results.length ? (
                <ul className="space-y-2">
                  {results.map((r) => (
                    <li key={r.player_id} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.player.display_name}</span>
                        <span className="block text-xs text-muted">
                          {r.team.name} · #{r.jersey_number}
                        </span>
                      </span>
                      <AdminForm action={linkChild} submitLabel="Vincular" compact className="contents">
                        <input type="hidden" name="family_id" value={family.id} />
                        <input type="hidden" name="player_id" value={r.player_id} />
                      </AdminForm>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Sin resultados para “{q}” en la temporada actual.</p>
              )
            ) : null}
          </div>
        </Section>

        <Section title="Datos de la familia">
          <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
            <AdminForm action={renameFamily} submitLabel="Cambiar nombre">
              <input type="hidden" name="id" value={family.id} />
              <Field name="name" label="Nombre">
                <TextInput name="name" defaultValue={family.name} required />
              </Field>
            </AdminForm>
            <div className="border-t border-border pt-4">
              <AdminForm
                action={deleteFamily}
                submitLabel="Eliminar familia"
                danger
                confirm="¿Eliminar la familia? Se quitan los vínculos (no se borran las cuentas ni los jugadores)."
              >
                <input type="hidden" name="id" value={family.id} />
              </AdminForm>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
