import type { Metadata } from "next";
import { PageTitle, Section } from "@/components/ui/section";
import { getSeasons } from "@/features/admin/data";
import { AdminForm, Field, TextInput } from "@/features/admin/form";
import { formatDateOnly } from "@/lib/format";
import { createSeason, setCurrentSeason, toggleSeasonClosed } from "./actions";

export const metadata: Metadata = { title: "Temporadas" };

export default async function SeasonsAdminPage() {
  const seasons = await getSeasons();
  const nextYear = seasons[0]?.year ?? new Date().getFullYear();

  return (
    <div className="space-y-8">
      <PageTitle title="Temporadas" subtitle="5 temporadas por año. La temporada actual es la que ve el público." />

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <Section title="Todas las temporadas">
          <ul className="space-y-3">
            {seasons.map((s) => (
              <li key={s.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{s.name}</h3>
                  {s.is_current ? (
                    <span className="rounded-full bg-brand-blue px-2 py-0.5 text-xs font-semibold text-white">Actual</span>
                  ) : null}
                  {s.closed_at ? (
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-muted">Cerrada</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted">
                  Del {formatDateOnly(s.starts_on)} al {formatDateOnly(s.ends_on)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!s.is_current ? (
                    <AdminForm action={setCurrentSeason} submitLabel="Marcar como actual" compact className="contents">
                      <input type="hidden" name="id" value={s.id} />
                    </AdminForm>
                  ) : null}
                  <AdminForm
                    action={toggleSeasonClosed}
                    submitLabel={s.closed_at ? "Reabrir" : "Cerrar temporada"}
                    confirm={s.closed_at ? undefined : "¿Cerrar la temporada? Se habilitarán los certificados de los jugadores."}
                    danger={!s.closed_at}
                    compact
                    className="contents"
                  >
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="close" value={s.closed_at ? "0" : "1"} />
                  </AdminForm>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Nueva temporada">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <AdminForm action={createSeason} submitLabel="Crear temporada" resetOnSuccess>
              <div className="grid grid-cols-2 gap-3">
                <Field name="year" label="Año">
                  <TextInput name="year" type="number" inputMode="numeric" defaultValue={nextYear} required />
                </Field>
                <Field name="number" label="Número (1–5)">
                  <TextInput name="number" type="number" inputMode="numeric" min={1} max={5} required />
                </Field>
              </div>
              <Field name="starts_on" label="Inicio">
                <TextInput name="starts_on" type="date" required />
              </Field>
              <Field name="ends_on" label="Fin">
                <TextInput name="ends_on" type="date" required />
              </Field>
            </AdminForm>
          </div>
        </Section>
      </div>
    </div>
  );
}
