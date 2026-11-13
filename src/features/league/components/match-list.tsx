import Link from "next/link";
import { MapPin } from "lucide-react";
import { TeamCrest } from "@/components/ui/team-crest";
import { formatDay, formatTime } from "@/lib/format";
import type { Category, Match } from "../data";

export function StatusBadge({ match }: { match: Match }) {
  switch (match.status) {
    case "live":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-red px-2 py-0.5 text-[11px] font-bold text-white">
          <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden />
          EN VIVO
        </span>
      );
    case "finished":
      return <span className="text-[11px] font-semibold text-muted uppercase">Final</span>;
    case "postponed":
      return <span className="text-[11px] font-semibold text-brand-red uppercase">Aplazado</span>;
    case "cancelled":
      return <span className="text-[11px] font-semibold text-brand-red uppercase">Cancelado</span>;
    default:
      return <span className="text-[11px] font-semibold text-brand-blue">{formatTime(match.startsAt)}</span>;
  }
}

function Score({ value, highlight }: { value: number | null; highlight: boolean }) {
  return (
    <span className={`w-6 text-right text-lg tabular-nums ${highlight ? "font-black" : "font-semibold text-muted"}`}>
      {value ?? ""}
    </span>
  );
}

/** Móvil: tarjeta de partido táctil (toda la tarjeta es un enlace). */
export function MatchCard({ match, category }: { match: Match; category?: Category }) {
  const hasScore = match.homeScore !== null && match.awayScore !== null;
  const homeWins = hasScore && match.homeScore! > match.awayScore!;
  const awayWins = hasScore && match.awayScore! > match.homeScore!;

  return (
    <Link
      href={`/partidos/${match.id}`}
      className="block rounded-2xl border border-border bg-surface p-4 transition-colors active:bg-surface-muted"
    >
      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted">
        <span>
          {category ? <strong className="mr-1.5 text-foreground">{category.code}</strong> : null}
          {formatDay(match.startsAt)}
          {match.matchday ? ` · Jornada ${match.matchday}` : ""}
        </span>
        <StatusBadge match={match} />
      </div>
      <div className="space-y-2">
        {[
          { team: match.home, score: match.homeScore, win: homeWins },
          { team: match.away, score: match.awayScore, win: awayWins },
        ].map(({ team, score, win }) => (
          <div key={team.id} className="flex items-center gap-3">
            <TeamCrest team={team} size="sm" />
            <span className={`flex-1 truncate ${win ? "font-bold" : "font-medium"}`}>{team.name}</span>
            {hasScore ? <Score value={score} highlight={win || match.homeScore === match.awayScore} /> : null}
          </div>
        ))}
      </div>
      {match.venue ? (
        <p className="mt-3 flex items-center gap-1 text-xs text-muted">
          <MapPin className="size-3.5" aria-hidden />
          {match.venue}
        </p>
      ) : null}
    </Link>
  );
}

/** Desktop: tabla completa de partidos. */
export function MatchTable({ matches, categories }: { matches: Match[]; categories?: Category[] }) {
  const catById = new Map(categories?.map((c) => [c.id, c]));
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-left text-xs text-muted uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">Fecha</th>
            {categories ? <th className="px-4 py-3 font-semibold">Cat.</th> : null}
            <th className="px-4 py-3 text-right font-semibold">Local</th>
            <th className="w-24 px-2 py-3 text-center font-semibold">Resultado</th>
            <th className="px-4 py-3 font-semibold">Visitante</th>
            <th className="px-4 py-3 font-semibold">Cancha</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {matches.map((m) => {
            const hasScore = m.homeScore !== null && m.awayScore !== null;
            return (
              <tr key={m.id} className="hover:bg-surface-muted/60">
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-medium">{formatDay(m.startsAt)}</span>
                  <span className="ml-2 text-muted">{formatTime(m.startsAt)}</span>
                </td>
                {categories ? (
                  <td className="px-4 py-3 font-semibold">{catById.get(m.categoryId)?.code}</td>
                ) : null}
                <td className="px-4 py-3">
                  <Link href={`/equipos/${m.home.id}`} className="flex items-center justify-end gap-2 font-medium hover:text-brand-blue">
                    {m.home.name}
                    <TeamCrest team={m.home} size="sm" />
                  </Link>
                </td>
                <td className="px-2 py-3 text-center">
                  <Link href={`/partidos/${m.id}`} className="inline-flex flex-col items-center hover:text-brand-blue">
                    {hasScore ? (
                      <span className="text-base font-black tabular-nums">
                        {m.homeScore} – {m.awayScore}
                      </span>
                    ) : (
                      <span className="font-semibold text-brand-blue">vs</span>
                    )}
                    {m.status !== "scheduled" ? <StatusBadge match={m} /> : null}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/equipos/${m.away.id}`} className="flex items-center gap-2 font-medium hover:text-brand-blue">
                    <TeamCrest team={m.away} size="sm" />
                    {m.away.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{m.venue ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Tarjetas en móvil y tabla en desktop: dos diseños, no uno encogido. */
export function MatchList({ matches, categories }: { matches: Match[]; categories?: Category[] }) {
  const catById = new Map(categories?.map((c) => [c.id, c]));
  return (
    <>
      <ul className="grid gap-3 md:hidden">
        {matches.map((m) => (
          <li key={m.id}>
            <MatchCard match={m} category={catById.get(m.categoryId)} />
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <MatchTable matches={matches} categories={categories} />
      </div>
    </>
  );
}
