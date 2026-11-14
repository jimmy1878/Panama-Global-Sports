import type { Metadata } from "next";
import { PageTitle, Section } from "@/components/ui/section";
import { getLeagues } from "@/features/admin/data";
import { AdminForm, Field, Select, TextInput } from "@/features/admin/form";
import { getCategories } from "@/features/league/data";
import { requireRole } from "@/lib/auth";
import { setLeagueMvp, setRecognitionMode } from "./actions";

export const metadata: Metadata = { title: "Ligas y categorías" };

const MODES = [
  { value: "individual_ranking", label: "Ranking individual" },
  { value: "team_stars", label: "Estrellas de equipo" },
] as const;

export default async function CategoriesAdminPage() {
  await requireRole(["admin"], "/admin/categorias");
  const [categories, leagues] = await Promise.all([getCategories(), getLeagues()]);

  return (
    <div className="space-y-8">
      <PageTitle title="Ligas y categorías" subtitle="Cómo se elige al jugador del partido y cómo se reconoce a los jugadores." />

      <Section title="Jugador del partido (MVP) por liga">
        <div className="grid gap-4 md:grid-cols-2">
          {leagues.map((l) => (
            <div key={l.id} className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="mb-3 font-bold">{l.name}</h3>
              <AdminForm action={setLeagueMvp}>
                <input type="hidden" name="id" value={l.id} />
                <Field name="mvp_mode" label="¿Quién elige al MVP?">
                  <Select name="mvp_mode" defaultValue={l.mvp_mode}>
                    <option value="official">El delegado o árbitro</option>
                    <option value="parent_vote">Votan las familias de los dos equipos</option>
                  </Select>
                </Field>
                <Field name="mvp_vote_hours" label="Horas de votación tras el final" hint="Solo si votan las familias. Normalmente 24.">
                  <TextInput name="mvp_vote_hours" type="number" min={1} max={72} defaultValue={l.mvp_vote_hours} />
                </Field>
              </AdminForm>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Con votación: un voto por familia y partido, nunca por un hijo propio. Gana el más votado de cada equipo; si hay empate,
          decide el delegado. Hasta que se active el cierre automático, ciérrala desde la ficha del partido.
        </p>
      </Section>

      <Section title="Reconocimiento por categoría">
        <dl className="mb-4 grid gap-3 rounded-2xl border border-border bg-surface p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Ranking individual</dt>
            <dd className="text-muted">
              Tablas de goleadores, asistencias, atajadas y fair play; nombres de goleadores en cada partido; certificados con
              estadísticas.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Estrellas de equipo</dt>
            <dd className="text-muted">
              Sin rankings individuales: se celebran los logros del equipo. Goles sin nombre y certificados de participación.
            </dd>
          </div>
        </dl>

        <div className="grid gap-6 md:grid-cols-2">
          {leagues.map((league) => (
            <section key={league.id}>
              <h3 className="mb-3 font-bold">{league.name}</h3>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {categories
                  .filter((c) => c.leagueId === league.id)
                  .map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-12 font-black">{c.code}</span>
                      <AdminForm action={setRecognitionMode} submitLabel="Guardar" compact className="flex flex-1 items-center gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <Select name="recognition_mode" defaultValue={c.recognitionMode} aria-label={`Modo de ${c.code}`}>
                          {MODES.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </Select>
                      </AdminForm>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </Section>
    </div>
  );
}
