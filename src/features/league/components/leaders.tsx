import { Star, Users } from "lucide-react";
import { TeamCrest } from "@/components/ui/team-crest";
import { LEADER_STATS, type LeaderRow, type TeamRecognition } from "../data";

/** Líderes por estadística (U10+). Móvil: una columna. Desktop: rejilla. */
export function LeaderBoards({ leaders }: { leaders: Record<string, LeaderRow[]> }) {
  const boards = LEADER_STATS.filter((s) => leaders[s.stat]?.length);
  if (!boards.length) {
    return <p className="text-sm text-muted">Todavía no hay estadísticas en esta categoría.</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {boards.map(({ stat, label, unit }) => (
        <section key={stat} className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-3 font-semibold">{label}</h3>
          <ol className="space-y-2.5">
            {leaders[stat].map((row, i) => (
              <li key={`${row.playerName}-${row.team.id}-${i}`} className="flex items-center gap-3">
                <span className="w-5 text-center text-sm font-bold text-muted tabular-nums">{row.position}</span>
                <TeamCrest team={row.team} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{row.playerName}</span>
                  <span className="block truncate text-xs text-muted">{row.team.name}</span>
                </span>
                <span className="text-right">
                  <span className="text-lg font-black tabular-nums">{row.value}</span>
                  <span className="sr-only"> {unit}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** U6/U8: reconocimientos de equipo, sin ranking individual. */
export function TeamStars({ rows }: { rows: TeamRecognition[] }) {
  return (
    <div>
      <p className="mb-4 flex items-start gap-2 rounded-2xl bg-brand-blue/5 p-4 text-sm">
        <Users className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden />
        En esta categoría celebramos al equipo: cada gol, asistencia, atajada y gesto de fair play suma una
        estrella para todos. No publicamos rankings individuales.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <li key={r.team.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
            <TeamCrest team={r.team} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{r.team.name}</span>
              <span className="block text-xs text-muted">
                {r.goals} goles · {r.fairPlay} fair play
              </span>
            </span>
            <span className="flex items-center gap-1 text-lg font-black tabular-nums">
              <Star className="size-5 fill-amber-400 text-amber-400" aria-hidden />
              {r.stars}
              <span className="sr-only"> estrellas</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
