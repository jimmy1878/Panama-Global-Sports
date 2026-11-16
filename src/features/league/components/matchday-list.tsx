import { EmptyState } from "@/components/ui/section";
import type { Match } from "../data";
import { MatchList } from "./match-list";

/**
 * Partidos agrupados por jornada: es como los vive una familia ("la jornada
 * del sábado"), y el mismo criterio que usa la galería.
 *
 * Conserva el orden en que llegan los partidos, así que sirve igual para el
 * calendario (de la próxima a la última) y para los resultados (al revés).
 */
export function MatchdayList({ matches, empty }: { matches: Match[]; empty: string }) {
  if (!matches.length) return <EmptyState>{empty}</EmptyState>;

  const groups = new Map<number | null, Match[]>();
  for (const m of matches) {
    groups.set(m.matchday, [...(groups.get(m.matchday) ?? []), m]);
  }

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([matchday, group]) => (
        <section key={matchday ?? "sin-jornada"}>
          <h3 className="mb-3 font-display text-lg tracking-wide uppercase md:text-xl">
            {matchday ? `Jornada ${matchday}` : "Sin jornada"}
          </h3>
          <MatchList matches={group} />
        </section>
      ))}
    </div>
  );
}
