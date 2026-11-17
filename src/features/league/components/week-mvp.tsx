import Link from "next/link";
import { Medal } from "lucide-react";
import { formatDay } from "@/lib/format";
import type { MatchMvp, WeekMvp } from "@/features/league/data";

/**
 * Los jugadores del partido del último partido jugado, presentados como
 * figuritas: es el anticipo del álbum y lo que una familia busca el domingo.
 *
 * La tarjeta empieza por el PARTIDO y no por el niño. Nombrar a un jugador sin
 * decir contra quién jugó ni cómo terminó deja el premio en el aire: el partido
 * es lo que lo explica.
 *
 * Se muestran los dos premiados, uno por equipo, porque así los elige la liga.
 * Quedarse con uno obligaría a decidir cuál de los dos niños vale más, y ese
 * criterio no existe en ningún lado.
 *
 * Sin foto todavía (hace falta el consentimiento de la familia): se usa el
 * escudo del equipo con sus colores.
 */
export function WeekMvpCard({ mvp }: { mvp: WeekMvp }) {
  const { match, players, othersInMatchday } = mvp;
  const hasScore = match.homeScore !== null && match.awayScore !== null;

  return (
    <article className="bg-brand-gradient flex flex-col gap-4 rounded-3xl border border-gold/25 p-5 text-white md:p-6">
      <span className="flex items-center gap-2 text-xs font-black tracking-widest text-gold uppercase">
        <Medal className="size-4" aria-hidden />
        {players.length > 1 ? "Jugadores del partido" : "Jugador del partido"}
      </span>

      {/* El partido: sin esto la tarjeta nombra a un niño y no dice de dónde sale */}
      <Link
        href={`/partidos/${match.id}`}
        className="flex flex-col gap-1 rounded-2xl bg-white/8 px-4 py-3 transition-colors hover:bg-white/12"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate font-medium">
            {match.home.name} – {match.away.name}
          </span>
          {hasScore ? (
            <span className="shrink-0 font-display text-xl tabular-nums">
              {match.homeScore}–{match.awayScore}
            </span>
          ) : null}
        </span>
        <span className="text-xs text-white/60">
          {formatDay(match.startsAt)}
          {match.matchday ? ` · Jornada ${match.matchday}` : ""}
          {mvp.categoryCode ? ` · ${mvp.categoryCode}` : ""}
        </span>
      </Link>

      {/* El contenido se centra en lo que sobre: en desktop la tarjeta estira
          hasta la altura de la columna de resultados. */}
      <div className="flex flex-1 flex-col justify-center gap-4">
        {players.map((player) => (
          <Player key={player.playerId} player={player} solo={players.length === 1} />
        ))}
      </div>

      {othersInMatchday > 0 ? (
        <Link href="/calendario" className="text-sm font-bold text-gold">
          Y otros {othersInMatchday} {othersInMatchday === 1 ? "premiado" : "premiados"}
          {match.matchday ? ` en la jornada ${match.matchday}` : ""} →
        </Link>
      ) : null}
    </article>
  );
}

function Player({ player, solo }: { player: MatchMvp; solo: boolean }) {
  const { stats } = player;
  const line = [
    stats.goals ? `${stats.goals} ${stats.goals === 1 ? "gol" : "goles"}` : null,
    stats.assists ? `${stats.assists} ${stats.assists === 1 ? "asistencia" : "asistencias"}` : null,
    stats.fairPlay ? "Fair play" : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-4">
      {/* Figurita: el escudo del equipo hace de retrato hasta que haya foto */}
      <span
        aria-hidden
        className={`grid shrink-0 place-items-center rounded-2xl border-4 border-gold font-display ${
          solo ? "h-36 w-28 text-3xl" : "h-24 w-20 text-2xl"
        }`}
        style={{ backgroundColor: player.team.primaryColor, color: player.team.secondaryColor }}
      >
        {(player.team.shortName ?? player.team.name).slice(0, 3).toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link href={`/jugadores/${player.playerId}`} className="font-display text-2xl leading-tight">
          {player.playerName}
        </Link>
        <span className="truncate text-sm text-white/75">{player.team.name}</span>
        {line.length ? <span className="text-sm">{line.join(" · ")}</span> : null}
      </div>
    </div>
  );
}
