import type { Metadata } from "next";
import { PageTitle, Section } from "@/components/ui/section";
import { getLeagues, getTournamentCatalogs, getTournaments } from "@/features/admin/data";
import { AdminForm, Field, Select, TextInput } from "@/features/admin/form";
import { formatDateOnly } from "@/lib/format";
import { createTournament, setTournamentStatus } from "./actions";

export const metadata: Metadata = { title: "Torneos" };

const STATUS_LABEL: Record<string, string> = {
  proximo: "Próximo",
  inscripciones: "Inscripciones abiertas",
  en_curso: "En curso",
  finalizado: "Finalizado",
};

/** Qué estados tiene sentido ofrecer desde cada estado actual. */
const NEXT_STATUS: Record<string, string[]> = {
  proximo: ["inscripciones", "en_curso"],
  inscripciones: ["en_curso", "proximo"],
  en_curso: ["finalizado"],
  finalizado: ["en_curso"],
};

export default async function TournamentsAdminPage() {
  const [tournaments, leagues, catalogs] = await Promise.all([
    getTournaments(),
    getLeagues(),
    getTournamentCatalogs(),
  ]);
  const nextYear = tournaments[0]?.year ?? new Date().getFullYear();

  // La Copa de Navidad solo existe en Academias: se avisa en el formulario
  // aunque la base lo impida igual.
  const allowedByType = new Map(
    catalogs.types.map((t) => [
      t.id,
      catalogs.allowed.filter((a) => a.tournament_type_id === t.id).map((a) => a.circuit_id),
    ]),
  );

  return (
    <div className="space-y-8">
      <PageTitle
        title="Torneos"
        subtitle="Liga × circuito × tipo × año. Pueden jugarse dos a la vez (Academias y Escolares)."
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <Section title="Todos los torneos">
          {tournaments.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay torneos.</p>
          ) : (
            <ul className="space-y-3">
              {tournaments.map((t) => (
                <li key={t.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">
                      {t.league?.name} · {t.name}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        t.status === "en_curso"
                          ? "bg-brand-blue text-white"
                          : "bg-surface-muted text-muted"
                      }`}
                    >
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {t.circuit?.name} · {t.type?.name} · Del {formatDateOnly(t.starts_on)} al {formatDateOnly(t.ends_on)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(NEXT_STATUS[t.status] ?? []).map((next) => (
                      <AdminForm
                        key={next}
                        action={setTournamentStatus}
                        submitLabel={STATUS_LABEL[next]}
                        confirm={
                          next === "finalizado"
                            ? "¿Finalizar el torneo? Pasa al historial y habilita los certificados."
                            : undefined
                        }
                        compact
                        className="contents"
                      >
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="status" value={next} />
                      </AdminForm>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Nuevo torneo">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <AdminForm action={createTournament} submitLabel="Crear torneo" resetOnSuccess>
              <Field name="league_id" label="Liga">
                <Select name="league_id" required>
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field name="circuit_id" label="Circuito">
                <Select name="circuit_id" required>
                  {catalogs.circuits.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field name="tournament_type_id" label="Tipo de torneo">
                <Select name="tournament_type_id" required>
                  {catalogs.types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {allowedByType.get(t.id)?.length === 1
                        ? ` (solo ${catalogs.circuits.find((c) => c.id === allowedByType.get(t.id)![0])?.name})`
                        : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field name="year" label="Año">
                <TextInput name="year" type="number" inputMode="numeric" defaultValue={nextYear} required />
              </Field>
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
