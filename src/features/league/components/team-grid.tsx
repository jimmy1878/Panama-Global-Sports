import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TeamCrest } from "@/components/ui/team-crest";
import { EmptyState } from "@/components/ui/section";
import type { StandingRow } from "../data";

/**
 * Los equipos de una categoría, ordenados por nombre. La tabla de posiciones
 * ya trae a todos con su puesto, así que no hace falta otra consulta.
 */
export function TeamGrid({ rows, categoryCode }: { rows: StandingRow[]; categoryCode: string }) {
  const teams = [...rows].sort((a, b) => a.team.name.localeCompare(b.team.name, "es"));
  if (!teams.length) return <EmptyState>Todavía no hay equipos en esta categoría.</EmptyState>;

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map(({ team, position, points, played }) => (
        <li key={team.id}>
          <Link
            href={`/equipos/${team.id}`}
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-brand-blue active:bg-surface-muted"
          >
            <TeamCrest team={team} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-bold">{team.name}</span>
              <span className="block text-sm text-muted">
                {categoryCode} · {position}º lugar · {points} pts
                {played ? "" : " · sin partidos"}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
