import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, ChevronLeft, Clock, HandHeart, MapPin, Medal, Trophy } from "lucide-react";
import { EmptyState, Section, Skeleton } from "@/components/ui/section";
import { TeamCrest } from "@/components/ui/team-crest";
import { StatusBadge } from "@/features/league/components/match-list";
import { getMatchDetail, isUuid, type MatchEvent, type Team } from "@/features/league/data";
import { formatLongDay, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Partido" };

export default function MatchPage({ params }: PageProps<"/partidos/[id]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/calendario" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-blue">
        <ChevronLeft className="size-4" aria-hidden />
        Calendario
      </Link>
      <Suspense fallback={<Skeleton className="h-[28rem]" />}>
        {params.then(({ id }) => (
          <MatchContent id={id} />
        ))}
      </Suspense>
    </div>
  );
}

async function MatchContent({ id }: { id: string }) {
  if (!isUuid(id)) notFound();
  const detail = await getMatchDetail(id);
  if (!detail) notFound();
  const { match, category, timeline, mvpByTeam, chronicle } = detail;
  const individual = category?.recognitionMode === "individual_ranking";
  const hasScore = match.homeScore !== null && match.awayScore !== null;

  return (
    <div className="space-y-6">
      {/* Marcador */}
      <section className="rounded-3xl border border-border bg-surface p-5 md:p-8">
        <div className="mb-4 flex items-center justify-between text-xs text-muted md:text-sm">
          <span>
            {category ? `${category.leagueName} · ${category.code}` : ""}
            {match.matchday ? ` · Jornada ${match.matchday}` : ""}
          </span>
          <StatusBadge match={match} />
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6">
          <TeamSide team={match.home} />
          <div className="text-center">
            {hasScore ? (
              <p className="text-4xl font-black tabular-nums md:text-6xl">
                {match.homeScore}
                <span className="mx-1 text-muted md:mx-3">–</span>
                {match.awayScore}
              </p>
            ) : (
              <p className="text-2xl font-black text-brand-blue md:text-3xl">{formatTime(match.startsAt)}</p>
            )}
          </div>
          <TeamSide team={match.away} />
        </div>
        <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-border pt-4 text-sm text-muted">
          <li className="flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden />
            {formatLongDay(match.startsAt)}
          </li>
          <li className="flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden />
            {formatTime(match.startsAt)}
          </li>
          {match.venue ? (
            <li className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />
              {match.venue}
            </li>
          ) : null}
        </ul>
      </section>

      {/* Jugador del partido (U10+) */}
      {individual && Object.keys(mvpByTeam).length ? (
        <Section title="Jugador del partido">
          <ul className="grid gap-3 sm:grid-cols-2">
            {[match.home, match.away].map((team) =>
              mvpByTeam[team.id] ? (
                <li key={team.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                  <Medal className="size-6 shrink-0 text-amber-500" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{mvpByTeam[team.id]}</span>
                    <span className="block truncate text-xs text-muted">{team.name}</span>
                  </span>
                </li>
              ) : null,
            )}
          </ul>
        </Section>
      ) : null}

      {/* Crónica publicada */}
      {chronicle ? (
        <Section title="Crónica">
          <p className="rounded-2xl border border-border bg-surface p-5 leading-relaxed">{chronicle}</p>
        </Section>
      ) : null}

      {/* Momentos del partido */}
      <Section title="Momentos del partido">
        {timeline.length ? (
          <Timeline events={timeline} home={match.home} away={match.away} />
        ) : (
          <EmptyState>{match.status === "scheduled" ? "El partido aún no empieza." : "Sin momentos registrados."}</EmptyState>
        )}
        {!individual ? (
          <p className="mt-3 text-xs text-muted">
            En {category?.code ?? "esta categoría"} celebramos al equipo: no destacamos nombres individuales.
          </p>
        ) : null}
      </Section>
    </div>
  );
}

function TeamSide({ team }: { team: Team }) {
  return (
    <Link href={`/equipos/${team.id}`} className="flex flex-col items-center gap-2 text-center hover:text-brand-blue">
      <TeamCrest team={team} size="lg" />
      <span className="line-clamp-2 text-sm font-bold md:text-base">{team.name}</span>
    </Link>
  );
}

const EVENT_LABEL: Record<string, { label: string; icon: typeof Trophy }> = {
  goal: { label: "Gol", icon: Trophy },
  own_goal: { label: "Gol en propia puerta", icon: Trophy },
  assist: { label: "Asistencia", icon: HandHeart },
  fair_play: { label: "Fair play", icon: HandHeart },
};

/** Línea de tiempo: local a la izquierda y visitante a la derecha (en desktop). */
function Timeline({ events, home, away }: { events: MatchEvent[]; home: Team; away: Team }) {
  return (
    <ol className="space-y-2">
      {events.map((e) => {
        const team = e.teamId === home.id ? home : away;
        const isHome = team.id === home.id;
        const meta = EVENT_LABEL[e.code] ?? { label: e.code, icon: Trophy };
        const Icon = meta.icon;
        // Autogol: lo anota el equipo rival en el marcador. Se muestra sin nombre.
        const text = e.code === "own_goal" ? `${meta.label} · suma para el rival` : e.playerName ? `${meta.label} · ${e.playerName}` : `${meta.label} de ${team.name}`;
        return (
          <li
            key={e.id}
            className={`flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 md:w-[85%] ${isHome ? "" : "md:ml-auto md:flex-row-reverse md:text-right"}`}
          >
            <span className="w-9 shrink-0 text-sm font-bold text-muted tabular-nums">{e.minute != null ? `${e.minute}'` : ""}</span>
            <Icon className={`size-5 shrink-0 ${e.code === "goal" ? "text-brand-blue" : "text-muted"}`} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{text}</span>
            <TeamCrest team={team} size="sm" />
          </li>
        );
      })}
    </ol>
  );
}
