import Link from "next/link";
import { LiveMinute } from "@/components/live/live-minute";
import { getCategories, getCurrentTournaments, getTodayMatches, type Match } from "@/features/league/data";
import { formatTime } from "@/lib/format";

/**
 * Barra "Hoy": todos los partidos del día, en juego, terminados o por jugar.
 * Se desplaza en horizontal, que en el celular es el gesto natural.
 */
export async function TodayBar() {
  const tournaments = await getCurrentTournaments();
  const [matches, categories] = await Promise.all([
    getTodayMatches(tournaments.map((t) => t.id)),
    getCategories(),
  ]);
  if (matches.length === 0) return null;

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <Shell>
      {matches.map((match) => {
        const category = categoryById.get(match.categoryId);
        const girls = category?.leagueGender === "girls";
        return (
          <Link
            key={match.id}
            href={`/partidos/${match.id}`}
            className="flex shrink-0 items-center gap-2 border-r border-white/15 pr-4 text-sm last:border-r-0"
          >
            <span className={`text-[11px] font-black tracking-wide uppercase ${girls ? "text-girls" : "text-boys"}`}>
              {girls ? "Girls" : "Boys"} {category?.code}
            </span>
            <span className="font-semibold whitespace-nowrap text-white">{summary(match)}</span>
            <Status match={match} />
          </Link>
        );
      })}
    </Shell>
  );
}

export function TodayBarFallback() {
  return (
    <Shell>
      <span className="text-sm text-white/50">Cargando los partidos de hoy…</span>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-white/10 bg-navy text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto px-4 py-2.5 md:px-6">
        <span className="shrink-0 rounded-md bg-live px-2.5 py-1 text-[11px] font-black tracking-widest text-white uppercase">
          Hoy
        </span>
        {children}
      </div>
    </div>
  );
}

/** "Tigres 2–1 Leones" si hay marcador; si no, "Tigres vs Leones". */
function summary(match: Match) {
  const hasScore = match.homeScore !== null && match.awayScore !== null;
  const home = match.home.shortName ?? match.home.name;
  const away = match.away.shortName ?? match.away.name;
  return hasScore
    ? `${home} ${match.homeScore}–${match.awayScore} ${away}`
    : `${home} vs ${away}`;
}

function Status({ match }: { match: Match }) {
  if (match.status === "live") {
    return (
      <span className="shrink-0 font-black whitespace-nowrap text-gold">
        EN VIVO <LiveMinute startedAt={match.startedAt} />
      </span>
    );
  }
  if (match.status === "finished") return <span className="shrink-0 font-black text-gold">FINAL</span>;
  return <span className="shrink-0 font-black whitespace-nowrap text-gold">{formatTime(match.startsAt)}</span>;
}
