import Link from "next/link";
import { Medal } from "lucide-react";
import type { WeekMvp } from "@/features/league/data";

/**
 * El jugador del partido más reciente, presentado como una figurita: es el
 * anticipo del álbum, y es lo que una familia busca cuando entra el domingo.
 *
 * Sin foto todavía (hace falta el consentimiento de la familia): se muestra el
 * escudo del equipo con sus colores.
 */
export function WeekMvpCard({ mvp }: { mvp: WeekMvp }) {
  const { stats } = mvp;
  const line = [
    stats.goals ? `${stats.goals} ${stats.goals === 1 ? "gol" : "goles"}` : null,
    stats.assists ? `${stats.assists} ${stats.assists === 1 ? "asistencia" : "asistencias"}` : null,
    stats.fairPlay ? "Fair play" : null,
  ].filter(Boolean);

  return (
    <article className="bg-brand-gradient flex flex-col gap-4 self-start rounded-3xl border border-gold/25 p-5 text-white md:p-6">
      <span className="flex items-center gap-2 text-xs font-black tracking-widest text-gold uppercase">
        <Medal className="size-4" aria-hidden />
        Jugador del partido
      </span>

      <div className="flex items-center gap-4">
        {/* Figurita: el escudo del equipo hace de retrato hasta que haya foto */}
        <span
          aria-hidden
          className="grid h-36 w-28 shrink-0 place-items-center rounded-2xl border-4 border-gold font-display text-3xl"
          style={{ backgroundColor: mvp.team.primaryColor, color: mvp.team.secondaryColor }}
        >
          {(mvp.team.shortName ?? mvp.team.name).slice(0, 3).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-display text-2xl leading-tight md:text-3xl">{mvp.playerName}</span>
          <span className="text-sm text-white/75">
            {mvp.team.name} · {mvp.categoryCode}
          </span>
          {line.length ? <span className="text-sm">{line.join(" · ")}</span> : null}
          <Link href={`/partidos/${mvp.matchId}`} className="mt-1 text-sm font-bold text-gold">
            Ver el partido
          </Link>
        </div>
      </div>
    </article>
  );
}
