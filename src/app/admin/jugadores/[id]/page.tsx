/* eslint-disable @next/next/no-img-element -- URL firmada temporal del bucket privado */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageTitle, Section, Skeleton } from "@/components/ui/section";
import { POSITIONS } from "@/features/admin/constants";
import { getPlayer } from "@/features/admin/data";
import { AdminForm, Checkbox, Field, Select, TextInput } from "@/features/admin/form";
import { isUuid } from "@/features/league/data";
import { deletePlayer, removeFromRoster, updatePlayer, updatePlayerPhoto } from "../../equipos/actions";

export const metadata: Metadata = { title: "Jugador" };

export default function PlayerAdminPage({ params, searchParams }: PageProps<"/admin/jugadores/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem]" />}>
      {Promise.all([params, searchParams]).then(([{ id }, sp]) => (
        <PlayerAdmin id={id} teamId={typeof sp.equipo === "string" ? sp.equipo : undefined} />
      ))}
    </Suspense>
  );
}

async function PlayerAdmin({ id, teamId }: { id: string; teamId?: string }) {
  if (!isUuid(id)) notFound();
  const player = await getPlayer(id);
  if (!player) notFound();

  // Inscripción a editar: la del equipo desde el que se llegó, o la más reciente.
  const roster = player.roster_entries.find((r) => r.team_id === teamId) ?? player.roster_entries.at(-1);
  const families = player.family_players.flatMap((fp) => (fp.family ? [fp.family] : []));

  return (
    <div className="space-y-8">
      {roster ? (
        <Link href={`/admin/equipos/${roster.team_id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue">
          <ChevronLeft className="size-4" aria-hidden />
          {roster.team?.name ?? "Equipo"}
        </Link>
      ) : null}
      <PageTitle title={player.display_name ?? "Jugador"} subtitle={roster ? `Camiseta ${roster.jersey_number}` : "Sin equipo"} />

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Datos">
          <div className="rounded-2xl border border-border bg-surface p-4">
            {roster ? (
              <AdminForm action={updatePlayer}>
                <input type="hidden" name="player_id" value={player.id} />
                <input type="hidden" name="roster_id" value={roster.id} />
                <input type="hidden" name="team_id" value={roster.team_id} />
                <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
                  <Field name="first_name" label="Nombre">
                    <TextInput name="first_name" defaultValue={player.first_name} required />
                  </Field>
                  <Field name="last_initial" label="Inicial">
                    <TextInput name="last_initial" defaultValue={player.last_initial} maxLength={1} required className="uppercase" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field name="jersey_number" label="Número">
                    <TextInput name="jersey_number" type="number" min={0} max={99} defaultValue={roster.jersey_number} required />
                  </Field>
                  <Field name="position" label="Posición">
                    <Select name="position" defaultValue={roster.position ?? ""}>
                      <option value="">—</option>
                      {POSITIONS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </AdminForm>
            ) : (
              <p className="text-sm text-muted">Este jugador no está inscrito en ningún equipo.</p>
            )}
          </div>
        </Section>

        <Section title="Foto y consentimiento">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-4 flex items-center gap-4">
              {player.photoUrl ? (
                <img src={player.photoUrl} alt="" className="size-20 rounded-full object-cover" />
              ) : (
                <span className="grid size-20 place-items-center rounded-full bg-surface-muted text-xs text-muted">Sin foto</span>
              )}
              <p className={`flex items-start gap-2 text-sm ${player.photo_consent ? "text-brand-blue" : "text-brand-red"}`}>
                {player.photo_consent ? (
                  <ShieldCheck className="size-5 shrink-0" aria-hidden />
                ) : (
                  <ShieldAlert className="size-5 shrink-0" aria-hidden />
                )}
                {player.photo_consent
                  ? "Con consentimiento: la foto es visible."
                  : "Sin consentimiento: la foto NO se muestra a nadie fuera de la familia y los administradores."}
              </p>
            </div>
            <AdminForm action={updatePlayerPhoto}>
              <input type="hidden" name="player_id" value={player.id} />
              <Field name="photo" label="Nueva foto" hint="Se recorta en cuadrado y se eliminan los datos de ubicación (EXIF/GPS).">
                <TextInput name="photo" type="file" accept="image/*" className="h-auto py-2" />
              </Field>
              <Checkbox
                name="photo_consent"
                defaultChecked={player.photo_consent}
                label="El padre, la madre o tutor dio su consentimiento para mostrar la foto"
              />
              {player.photo_path ? <Checkbox name="remove_photo" label="Quitar la foto actual" /> : null}
            </AdminForm>
            <p className="mt-3 text-xs text-muted">
              Lo ideal es que la familia dé o retire el consentimiento desde su cuenta (fase 5). Úsalo aquí solo con autorización
              por escrito.
            </p>
          </div>
        </Section>

        <Section title="Familia">
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
            {families.length ? (
              <ul className="space-y-2">
                {families.map((f) => (
                  <li key={f.id}>
                    <Link href={`/admin/familias/${f.id}`} className="font-medium text-brand-blue">
                      {f.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">
                Sin familia vinculada. Vincúlalo desde{" "}
                <Link href="/admin/familias" className="font-medium text-brand-blue">
                  Familias
                </Link>
                .
              </p>
            )}
          </div>
        </Section>

        <Section title="Quitar o eliminar">
          <div className="space-y-4 rounded-2xl border border-brand-red/30 bg-surface p-4">
            {roster ? (
              <div>
                <p className="mb-2 text-sm text-muted">Quitarlo de {roster.team?.name}: se conservan sus datos y estadísticas.</p>
                <AdminForm action={removeFromRoster} submitLabel="Quitar del equipo" danger confirm="¿Quitar al jugador de este equipo?">
                  <input type="hidden" name="roster_id" value={roster.id} />
                  <input type="hidden" name="team_id" value={roster.team_id} />
                </AdminForm>
              </div>
            ) : null}
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm text-muted">
                Eliminar al jugador borra <strong>todos</strong> sus datos, fotos y estadísticas (derecho de supresión). No se
                puede deshacer.
              </p>
              <AdminForm action={deletePlayer} submitLabel="Eliminar definitivamente" danger>
                <input type="hidden" name="player_id" value={player.id} />
                <input type="hidden" name="team_id" value={roster?.team_id ?? ""} />
                <input type="hidden" name="expected_name" value={player.display_name ?? ""} />
                <Field name="confirm_name" label={`Escribe "${player.display_name}" para confirmar`}>
                  <TextInput name="confirm_name" autoComplete="off" />
                </Field>
              </AdminForm>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
