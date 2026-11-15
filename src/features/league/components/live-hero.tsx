import Link from "next/link";
import { MapPin } from "lucide-react";
import { LiveMinute } from "@/components/live/live-minute";
import type { Category, Match, Tournament } from "@/features/league/data";

/**
 * El partido que se está jugando, en grande: lo primero que ve una familia al
 * entrar un sábado por la mañana. Si hay más de uno en curso, los demás van
 * como pastillas debajo.
 *
 * No mostramos "primer/segundo tiempo" porque la base no guarda el reloj del
 * partido: solo el minuto corrido desde el inicio real.
 */
export function LiveHero({
  match,
  others,
  category,
  tournament,
}: {
  match: Match;
  others: Match[];
  category?: Category;
  tournament?: Tournament;
}) {
  const contexto = [
    category?.leagueGender === "girls" ? "Girls" : "Boys",
    tournament?.circuitName,
    `${tournament?.typeName ?? ""} ${tournament?.year ?? ""}`.trim(),
    category?.code,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      id="en-vivo"
      className="bg-brand-gradient relative overflow-hidden rounded-3xl border border-gold/25 p-5 text-white md:p-8"
    >
      {/* Arcos dorados, como los del diseño */}
      <svg
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-[36rem] opacity-50"
        viewBox="0 0 600 260"
        fill="none"
      >
        <path d="M-40 250 C 120 120, 320 60, 640 30" stroke="#DFAF42" strokeOpacity="0.5" strokeWidth="10" />
        <path d="M-40 280 C 140 150, 340 90, 640 60" stroke="#DFAF42" strokeOpacity="0.28" strokeWidth="5" />
      </svg>

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg bg-live px-3 py-1.5 text-xs font-black tracking-wide uppercase">
              <span aria-hidden className="size-2 rounded-full bg-white" />
              Jugándose ahora
            </span>
            {contexto ? (
              <span className="rounded-lg bg-white/12 px-3 py-1.5 text-xs font-semibold md:text-sm">{contexto}</span>
            ) : null}
          </div>
          {match.venue ? (
            <span className="flex items-center gap-1.5 text-xs text-white/75 md:text-sm">
              <MapPin className="size-4" aria-hidden />
              {match.venue}
            </span>
          ) : null}
        </div>

        <Link
          href={`/partidos/${match.id}`}
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6"
          aria-label={`${match.home.name} contra ${match.away.name}, en vivo`}
        >
          <TeamSide name={match.home.name} short={match.home.shortName} color={match.home.primaryColor} />
          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-5xl leading-none tabular-nums md:text-7xl">
              {match.homeScore ?? 0} <span className="text-white/40">–</span> {match.awayScore ?? 0}
            </span>
            <LiveMinute startedAt={match.startedAt} className="text-sm font-black text-gold md:text-base" />
          </div>
          <TeamSide name={match.away.name} short={match.away.shortName} color={match.away.primaryColor} />
        </Link>

        {others.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/15 pt-4">
            <span className="text-[11px] font-black tracking-widest text-white/70 uppercase">También en juego</span>
            {others.map((other) => (
              <Link
                key={other.id}
                href={`/partidos/${other.id}`}
                className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold"
              >
                {other.home.shortName ?? other.home.name} {other.homeScore ?? 0}–{other.awayScore ?? 0}{" "}
                {other.away.shortName ?? other.away.name}{" "}
                <LiveMinute startedAt={other.startedAt} className="font-black text-gold" />
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TeamSide({ name, short, color }: { name: string; short: string | null; color: string }) {
  return (
    <span className="flex flex-col items-center gap-2 text-center">
      <span
        aria-hidden
        className="grid size-16 place-items-center rounded-full border-4 border-white font-display text-xl md:size-26 md:text-3xl"
        style={{ backgroundColor: color }}
      >
        {(short ?? name).slice(0, 2).toUpperCase()}
      </span>
      <span className="font-display text-lg leading-tight md:text-2xl">{name}</span>
    </span>
  );
}
