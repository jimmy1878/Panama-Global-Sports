import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/section";
import { AdminForm, Select } from "@/features/admin/form";
import { getCategories } from "@/features/league/data";
import { requireRole } from "@/lib/auth";
import { setRecognitionMode } from "./actions";

export const metadata: Metadata = { title: "Categorías" };

const MODES = [
  { value: "individual_ranking", label: "Ranking individual" },
  { value: "team_stars", label: "Estrellas de equipo" },
] as const;

export default async function CategoriesAdminPage() {
  await requireRole(["admin"], "/admin/categorias");
  const categories = await getCategories();
  const leagues = [...new Map(categories.map((c) => [c.leagueId, c.leagueName])).entries()];

  return (
    <div className="space-y-6">
      <PageTitle
        title="Categorías"
        subtitle="Elige cómo se reconoce a los jugadores en cada categoría."
      />

      <dl className="grid gap-3 rounded-2xl border border-border bg-surface p-4 text-sm sm:grid-cols-2">
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
        {leagues.map(([leagueId, leagueName]) => (
          <section key={leagueId}>
            <h2 className="mb-3 font-bold">{leagueName}</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {categories
                .filter((c) => c.leagueId === leagueId)
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
    </div>
  );
}
