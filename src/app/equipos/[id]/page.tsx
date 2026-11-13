import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, Star } from "lucide-react";
import { EmptyState, Section, Skeleton } from "@/components/ui/section";
import { TeamCrest } from "@/components/ui/team-crest";
import { MatchList } from "@/features/league/components/match-list";
import {
  getCategories,
  getMatches,
  getStandings,
  getTeamDetail,
  getTeamPlayerStats,
  getTeamRecognitions,
  isUuid,
  type PlayerStatLine,
  type RosterPlayer,
} from "@/features/league/data";

export const metadata: Metadata = { title: "Equipo" };

export default function TeamPage({ params }: PageProps<"/equipos/[id]">) {
  return (
    <div>
      <Link href="/equipos" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-blue">
        <ChevronLeft className="size-4" aria-hidden />
        Equipos
      </Link>
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        {params.then(({ id }) => (
          <TeamContent id={id} />
        ))}
      </Suspense>
    </div>
  );
}

async function TeamContent({ id }: { id: string }) {
  if (!isUuid(id)) notFound();
  const detail = await getTeamDetail(id);
  if (!detail) notFound();
  const { team, seasonId, players } = detail;

  const categories = await getCategories();
  const category = categories.find((c) => c.id === team.categoryId);
  const individual = category?.recognitionMode === "individual_ranking";

  const [matches, standings, stats, recognitions] = await Promise.all([
    getMatches({ seasonId, teamId: team.id }),
    getStandings(seasonId, team.categoryId),
    individual ? getTeamPlayerStats(seasonId, team.id) : Promise.resolve({} as Record<string, PlayerStatLine>),
    individual ? Promise.resolve([]) : getTeamRecognitions(seasonId, team.categoryId),
  ]);
  const standing = standings.find((s) => s.team.id === team.id);
  const stars = recognitions.find((r) => r.team.id === team.id)?.stars;

  return (
    <div className="space-y-8">
      {/* Cabecera con los colores del equipo */}
      <header
        className="flex items-center gap-4 rounded-3xl p-5 md:gap-6 md:p-8"
        style={{ background: `linear-gradient(135deg, ${team.primaryColor}1f, transparent 70%)` }}
      >
        <TeamCrest team={team} size="xl" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black md:text-4xl">{team.name}</h1>
          {category ? (
            <p className="text-sm text-muted md:text-base">
              {category.leagueName} · {category.code}
            </p>
          ) : null}
        </div>
      </header>

      {/* Resumen */}
      <dl className="grid grid-cols-3 gap-3 md:max-w-xl">
        <Stat label="Posición" value={standing ? `${standing.position}º` : "—"} />
        <Stat label="Puntos" value={standing?.points ?? 0} />
        {individual ? (
          <Stat label="Jugados" value={standing?.played ?? 0} />
        ) : (
          <Stat
            label="Estrellas"
            value={
              <span className="inline-flex items-center gap-1">
                <Star className="size-5 fill-amber-400 text-amber-400" aria-hidden />
                {stars ?? 0}
              </span>
            }
          />
        )}
      </dl>

      {/* Desktop: plantel y partidos en dos columnas */}
      <div className="grid gap-8 lg:grid-cols-5">
        <Section title={`Plantel (${players.length})`} className="lg:col-span-2">
          {players.length ? (
            <Roster players={players} stats={individual ? stats : null} />
          ) : (
            <EmptyState>Plantel por confirmar.</EmptyState>
          )}
        </Section>
        <Section title="Partidos" className="lg:col-span-3">
          {matches.length ? <MatchList matches={matches} /> : <EmptyState>Sin partidos programados.</EmptyState>}
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 text-center md:p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-black tabular-nums md:text-2xl">{value}</dd>
    </div>
  );
}

/** stats = null en U6/U8: sin números individuales. */
function Roster({ players, stats }: { players: RosterPlayer[]; stats: Record<string, PlayerStatLine> | null }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {players.map((p) => {
        const s = stats?.[p.playerId];
        return (
          <li key={p.playerId} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-muted text-sm font-black tabular-nums">
              {p.jerseyNumber}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{p.displayName}</span>
              {p.position ? <span className="block text-xs text-muted">{p.position}</span> : null}
            </span>
            {stats ? (
              <span className="flex gap-3 text-xs text-muted tabular-nums">
                <span title="Goles">
                  <strong className="text-sm text-foreground">{s?.goals ?? 0}</strong> G
                </span>
                <span title="Asistencias">
                  <strong className="text-sm text-foreground">{s?.assists ?? 0}</strong> A
                </span>
                <span title="Jugador del partido" className="hidden sm:inline">
                  <strong className="text-sm text-foreground">{s?.mvps ?? 0}</strong> MVP
                </span>
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
