/* eslint-disable @next/next/no-img-element -- URL firmada temporal del bucket privado */
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Award, CalendarDays, Download, Hand, HandHeart, MapPin, Medal, Star, Trophy } from "lucide-react";
import { EmptyState, PageTitle, Section, Skeleton } from "@/components/ui/section";
import { TeamCrest } from "@/components/ui/team-crest";
import { getMyCertificates, type CertificateRow } from "@/features/certificates/data";
import { ConsentToggle, FollowButton } from "@/features/family/components";
import { getMyFamily, type Child } from "@/features/family/data";
import { StatusBadge } from "@/features/league/components/match-list";
import { getCurrentTeams, getCurrentTournaments, getMatches, type Match, type Team } from "@/features/league/data";
import { formatDay, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Mi familia", robots: { index: false } };

export default function FamiliaPage() {
  return (
    <div>
      <PageTitle title="Mi familia" subtitle="Tus hijos, sus partidos y la privacidad de sus fotos." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <FamilyContent />
      </Suspense>
    </div>
  );
}

async function FamilyContent() {
  const tournaments = await getCurrentTournaments();
  const family = await getMyFamily(tournaments.map((t) => t.id));

  if (!family.children.length) {
    return (
      <EmptyState>
        Todavía no hay hijos vinculados a tu cuenta. Pide al administrador de la liga que vincule a tus hijos con tu correo:{" "}
        <strong className="text-foreground">{family.user.email}</strong>
      </EmptyState>
    );
  }

  const [teams, certificates] = await Promise.all([getCurrentTeams(), getMyCertificates()]);
  const followed = new Set(family.followedTeamIds);
  const childTeamIds = [...new Set(family.children.flatMap((c) => (c.team ? [c.team.id] : [])))];

  // Próximo partido (o en vivo) de cada equipo de los hijos
  const nextByTeam = new Map<string, Match | undefined>();
  // Un hijo puede jugar en varios torneos a la vez: se miran todos los que están en curso
  await Promise.all(
    childTeamIds.map(async (teamId) => {
      const matches = (await Promise.all(tournaments.map((t) => getMatches({ tournamentId: t.id, teamId })))).flat();
      matches.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      nextByTeam.set(teamId, matches.find((m) => m.status === "live") ?? matches.find((m) => m.status === "scheduled"));
    }),
  );

  const followedTeams = teams.filter((t) => followed.has(t.id));

  return (
    <div className="space-y-8">
      {/* Móvil: una tarjeta por hijo. Desktop: dos columnas. */}
      <ul className="grid gap-4 lg:grid-cols-2">
        {family.children.map((child) => (
          <li key={child.playerId}>
            <ChildCard
              child={child}
              team={teams.find((t) => t.id === child.team?.id)}
              nextMatch={child.team ? nextByTeam.get(child.team.id) : undefined}
              following={child.team ? followed.has(child.team.id) : false}
            />
          </li>
        ))}
      </ul>

      <Certificates rows={certificates} />

      <Section title="Equipos que sigues" href="/avisos" linkLabel="Configurar avisos">
        {followedTeams.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {followedTeams.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <TeamCrest team={t} />
                <Link href={`/equipos/${t.id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-brand-blue">
                  {t.name}
                </Link>
                <FollowButton teamId={t.id} following compact />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            Aún no sigues ningún equipo. Sigue el de tus hijos para recibir recordatorios y resultados cuando activemos las
            notificaciones.
          </p>
        )}
      </Section>
    </div>
  );
}

/**
 * Certificados: uno por hijo y por torneo terminado. Van en su propia sección
 * y no en la tarjeta del hijo porque se acumulan con cada torneo y la lista
 * crece: un niño que juega en su academia y en su colegio suma dos al año.
 */
function Certificates({ rows }: { rows: CertificateRow[] }) {
  return (
    <Section title="Certificados">
      {rows.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <li
              key={`${row.playerId}-${row.tournamentId}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <Award className="size-9 shrink-0 text-gold" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{row.name}</p>
                <p className="truncate text-sm text-muted">{row.tournamentName}</p>
                <p className="truncate text-xs text-muted">
                  {row.teamName}
                  {row.categoryLabel ? ` · ${row.categoryLabel}` : ""}
                </p>
              </div>
              {/* Enlace normal, no una acción: el navegador descarga el PDF. */}
              <a
                href={`/familia/certificado?jugador=${row.playerId}&torneo=${row.tournamentId}`}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white"
              >
                <Download className="size-4" aria-hidden />
                PDF
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          El certificado de cada hijo aparece aquí cuando su torneo termina, con sus estadísticas de ese torneo. Ahora
          mismo no hay ninguno terminado.
        </p>
      )}
    </Section>
  );
}

function ChildCard({ child, team, nextMatch, following }: { child: Child; team?: Team; nextMatch?: Match; following: boolean }) {
  const s = child.stats;
  return (
    <article className="space-y-4 rounded-3xl border border-border bg-surface p-4 md:p-5">
      <header className="flex items-center gap-4">
        {child.photoUrl ? (
          <img src={child.photoUrl} alt="" className="size-16 rounded-full object-cover" />
        ) : (
          <span className="grid size-16 place-items-center rounded-full bg-surface-muted text-xl font-black tabular-nums">
            {child.jerseyNumber ?? "?"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold">{child.name}</h2>
          {team ? (
            <Link href={`/equipos/${team.id}`} className="mt-0.5 flex items-center gap-2 text-sm text-muted hover:text-brand-blue">
              <TeamCrest team={team} size="sm" />
              <span className="truncate">
                {team.name}
                {child.jerseyNumber !== null ? ` · #${child.jerseyNumber}` : ""}
                {child.position ? ` · ${child.position}` : ""}
              </span>
            </Link>
          ) : (
            <p className="text-sm text-muted">Sin equipo en los torneos en curso</p>
          )}
        </div>
      </header>

      {/* Estadísticas del torneo */}
      <dl className="grid grid-cols-5 gap-1 rounded-2xl bg-surface-muted p-2 text-center">
        <Stat icon={Star} label="Estrellas" value={s.stars} tone="fill-amber-400 text-amber-400" />
        <Stat icon={Trophy} label="Goles" value={s.goals} />
        <Stat icon={HandHeart} label="Asist." value={s.assists} />
        <Stat icon={Hand} label="Atajadas" value={s.saves} />
        <Stat icon={Medal} label="MVP" value={s.mvps} tone="text-amber-500" />
      </dl>

      {nextMatch ? (
        <Link href={`/partidos/${nextMatch.id}`} className="block rounded-2xl border border-border p-3 hover:border-brand-blue">
          <span className="mb-1 flex items-center justify-between text-xs text-muted">
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {nextMatch.status === "live" ? "Jugando ahora" : "Próximo partido"}
            </span>
            <StatusBadge match={nextMatch} />
          </span>
          <span className="block font-semibold">
            {nextMatch.home.name} vs {nextMatch.away.name}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted">
            {formatDay(nextMatch.startsAt)} · {formatTime(nextMatch.startsAt)}
            {nextMatch.venue ? (
              <>
                {" · "}
                <MapPin className="size-3.5" aria-hidden />
                {nextMatch.venue}
              </>
            ) : null}
          </span>
        </Link>
      ) : null}

      <ConsentToggle playerId={child.playerId} consent={child.photoConsent} childName={child.name} />

      {team ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Sigue al equipo para recibir avisos de sus partidos.</p>
          <FollowButton teamId={team.id} following={following} compact />
        </div>
      ) : null}
    </article>
  );
}

function Stat({ icon: Icon, label, value, tone = "text-muted" }: { icon: typeof Star; label: string; value: number; tone?: string }) {
  return (
    <div className="py-1">
      <dt className="flex flex-col items-center gap-0.5 text-[10px] text-muted">
        <Icon className={`size-4 ${tone}`} aria-hidden />
        {label}
      </dt>
      <dd className="text-lg font-black tabular-nums">{value}</dd>
    </div>
  );
}
