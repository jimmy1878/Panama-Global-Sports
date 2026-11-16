import Link from "next/link";
import { TeamCrest } from "@/components/ui/team-crest";
import type { FormResult, StandingRow } from "../data";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

const FORM_STYLE: Record<FormResult, string> = {
  G: "bg-emerald-700 text-white",
  E: "bg-slate-300 text-slate-800",
  P: "bg-slate-800 text-white",
};

const FORM_LABEL: Record<FormResult, string> = { G: "ganó", E: "empató", P: "perdió" };

/** Los últimos partidos del equipo, del más antiguo al más reciente. */
export function FormRow({ form, className = "" }: { form: FormResult[]; className?: string }) {
  if (!form.length) return null;
  return (
    <span className={`flex gap-1 ${className}`}>
      <span className="sr-only">Últimos partidos: {form.map((f) => FORM_LABEL[f]).join(", ")}.</span>
      {form.map((f, i) => (
        <span
          key={i}
          aria-hidden
          className={`grid size-5 place-items-center rounded-md text-[10px] font-black ${FORM_STYLE[f]}`}
        >
          {f}
        </span>
      ))}
    </span>
  );
}

/**
 * Tabla de posiciones. Móvil: compacta (Pos, equipo, PJ, DG, Pts) con la forma
 * debajo del nombre. Desktop: completa (PJ, G, E, P, GF, GC, DG, Pts) y la
 * forma en su propia columna.
 */
export function StandingsTable({
  rows,
  highlightTeamId,
  form,
}: {
  rows: StandingRow[];
  highlightTeamId?: string;
  form?: Record<string, FormResult[]>;
}) {
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
            {form ? <th className="hidden w-32 py-3 pr-4 text-left font-semibold md:table-cell">Últimos 5</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.team.id} className={r.team.id === highlightTeamId ? "bg-brand-blue/5" : undefined}>
              <td className="py-3 pl-4 align-top font-semibold text-muted tabular-nums md:align-middle">{r.position}</td>
              <td className="py-3 pl-2">
                <Link href={`/equipos/${r.team.id}`} className="flex items-center gap-2 font-medium hover:text-brand-blue">
                  <TeamCrest team={r.team} size="sm" />
                  <span className="truncate">{r.team.name}</span>
                </Link>
                {/* Móvil: la forma va debajo del nombre; en desktop tiene columna */}
                {form?.[r.team.id]?.length ? (
                  <FormRow form={form[r.team.id]} className="mt-2 ml-9 md:hidden" />
                ) : null}
              </td>
              <td className="py-3 text-center align-top tabular-nums md:align-middle">{r.played}</td>
              <td className="hidden py-3 text-center tabular-nums md:table-cell">{r.won}</td>
              <td className="hidden py-3 text-center tabular-nums md:table-cell">{r.drawn}</td>
              <td className="hidden py-3 text-center tabular-nums md:table-cell">{r.lost}</td>
              <td className="hidden py-3 text-center tabular-nums md:table-cell">{r.goalsFor}</td>
              <td className="hidden py-3 text-center tabular-nums md:table-cell">{r.goalsAgainst}</td>
              <td className="py-3 text-center align-top text-muted tabular-nums md:align-middle">
                {signed(r.goalDifference)}
              </td>
              <td className="py-3 pr-4 text-center align-top font-display text-lg tabular-nums md:align-middle">
                {r.points}
              </td>
              {form ? (
                <td className="hidden py-3 pr-4 md:table-cell">
                  <FormRow form={form[r.team.id] ?? []} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted">
        PJ: jugados · DG: diferencia de goles · Pts: puntos (3 por victoria, 1 por empate)
      </p>
    </div>
  );
}
