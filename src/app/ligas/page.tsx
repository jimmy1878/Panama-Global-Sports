import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageTitle, Skeleton } from "@/components/ui/section";
import { formatDateOnly } from "@/lib/format";
import {
  getCategoriesByTournament,
  getTournamentProgress,
  getTournaments,
  type Tournament,
  type TournamentStatus,
} from "@/features/league/data";
import { categoryPath } from "@/features/league/paths";

export const metadata: Metadata = {
  title: "Torneos",
  description: "Las ligas, los circuitos y los torneos de Panama Global Sports, con todas sus categorías.",
};

const STATUS_LABEL: Record<TournamentStatus, string> = {
  en_curso: "En curso",
  inscripciones: "Inscripciones abiertas",
  proximo: "Próximo",
  finalizado: "Finalizado",
};

/** Índice de torneos: la puerta de entrada a cada categoría. */
export default function LigasPage() {
  return (
    <div>
      <PageTitle
        title="Torneos"
        subtitle="Cada liga se juega en Academias y en Escolares. Elige una categoría para ver su tabla, su calendario y sus líderes."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Leagues />
      </Suspense>
    </div>
  );
}

async function Leagues() {
  const tournaments = await getTournaments();
  if (!tournaments.length) return <EmptyState>Todavía no hay torneos configurados.</EmptyState>;

  const ids = tournaments.map((t) => t.id);
  const [categoriesByTournament, progress] = await Promise.all([
    getCategoriesByTournament(ids),
    getTournamentProgress(ids),
  ]);

  // Agrupados por liga, conservando el orden en que vienen (los que se juegan primero)
  const byLeague = new Map<string, Tournament[]>();
  for (const t of tournaments) byLeague.set(t.leagueId, [...(byLeague.get(t.leagueId) ?? []), t]);

  return (
    <div className="space-y-10">
      {[...byLeague.values()].map((ofLeague) => {
        const [first] = ofLeague;
        const girls = first.leagueName.toLowerCase().includes("girls");
        return (
          <section key={first.leagueId}>
            <h2 className="mb-4 flex items-center gap-3 font-display text-2xl tracking-wide uppercase md:text-3xl">
              <span aria-hidden className="h-7 w-2 rounded-full" style={{ backgroundColor: girls ? "var(--girls)" : "var(--boys)" }} />
              {first.leagueName}
            </h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {ofLeague.map((t) => {
                const categories = categoriesByTournament[t.id] ?? [];
                const done = progress[t.id];
                return (
                  <li
                    key={t.id}
                    className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5 md:p-6"
                  >
                    <div>
                      <p className="text-xs font-black tracking-widest text-muted uppercase">
                        {STATUS_LABEL[t.status]}
                        {done && done.total > 0 ? ` · Jornada ${Math.min(done.played + 1, done.total)} de ${done.total}` : ""}
                      </p>
                      <h3 className="font-display text-xl md:text-2xl">{t.name}</h3>
                      <p className="mt-1 text-sm text-muted">
                        {t.circuitName} · del {formatDateOnly(t.startsOn)} al {formatDateOnly(t.endsOn)}
                      </p>
                    </div>
                    {categories.length ? (
                      <ul className="flex flex-wrap gap-2">
                        {categories.map((category) => (
                          <li key={category.id}>
                            <Link
                              href={categoryPath(category, t)}
                              className="grid min-h-11 min-w-16 place-items-center rounded-xl border border-border bg-surface-muted px-3 font-display text-lg transition-colors hover:border-brand-blue hover:text-brand-blue"
                            >
                              {category.code}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted">
                        {t.status === "finalizado"
                          ? "Este torneo no dejó datos en el historial."
                          : "Sin categorías asignadas todavía."}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
