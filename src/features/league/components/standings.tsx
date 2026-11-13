import Link from "next/link";
import { TeamCrest } from "@/components/ui/team-crest";
import type { StandingRow } from "../data";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/**
 * Tabla de posiciones. Móvil: compacta (Pos, equipo, PJ, DG, Pts).
 * Desktop: completa (PJ, G, E, P, GF, GC, DG, Pts).
 */
export function StandingsTable({ rows, highlightTeamId }: { rows: StandingRow[]; highlightTeamId?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-xs text-muted uppercase">
          <tr>
            <th className="w-10 py-3 pl-4 text-left font-semibold">#</th>
            <th className="py-3 pl-2 text-left font-semibold">Equipo</th>
            <th className="w-10 py-3 text-center font-semibold" title="Partidos jugados">PJ</th>
            <th className="hidden w-10 py-3 text-center font-semibold md:table-cell" title="Ganados">G</th>
            <th className="hidden w-10 py-3 text-center font-semibold md:table-cell" title="Empatados">E</th>
            <th className="hidden w-10 py-3 text-center font-semibold md:table-cell" title="Perdidos">P</th>
            <th className="hidden w-10 py-3 text-center font-semibold md:table-cell" title="Goles a favor">GF</th>
            <th className="hidden w-10 py-3 text-center font-semibold md:table-cell" title="Goles en contra">GC</th>
            <th className="w-12 py-3 text-center font-semibold" title="Diferencia de goles">DG</th>
            <th className="w-14 py-3 pr-4 text-center font-semibold" title="Puntos">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.team.id} className={r.team.id === highlightTeamId ? "bg-brand-blue/5" : undefined}>
              <td className="py-3 pl-4 font-semibold text-muted tabular-nums">{r.position}</td>
              <td className="py-3 pl-2">
                <Link href={`/equipos/${r.team.id}`} className="flex items-center gap-2 font-medium hover:text-brand-blue">
                  <TeamCrest team={r.team} size="sm" />
                  <span className="truncate">{r.team.name}</span>
                </Link>
              </td>
              <td className="py-3 text-center tabular-nums">{r.played}</td>
              <td className="hidden py-3 text-center tabular-nums md:table-cell">{r.won}</td>
              <td className="hidden py-3 text-center tabular-nums md:table-cell">{r.drawn}</td>
              <td className="hidden py-3 text-center tabular-nums md:table-cell">{r.lost}</td>
              <td className="hidden py-3 text-center tabular-nums md:table-cell">{r.goalsFor}</td>
              <td className="hidden py-3 text-center tabular-nums md:table-cell">{r.goalsAgainst}</td>
              <td className="py-3 text-center text-muted tabular-nums">{signed(r.goalDifference)}</td>
              <td className="py-3 pr-4 text-center font-black tabular-nums">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted md:hidden">
        PJ: jugados · DG: diferencia de goles · Pts: puntos (3 victoria, 1 empate)
      </p>
    </div>
  );
}
