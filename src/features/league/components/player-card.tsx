/* eslint-disable @next/next/no-img-element -- URL firmada que caduca; next/image no la puede optimizar */
import Link from "next/link";
import { ChevronLeft, Lock } from "lucide-react";
import type { PlayerBadge, PlayerProfile } from "../player";
import { categoryPath } from "../paths";

/**
 * La figurita: la ficha del jugador tal como la plantea el diseño, y el
 * anticipo del álbum.
 *
 * Si la familia no dio consentimiento se dibuja una silueta y se dice por qué.
 * Nunca se enseña una foto "por si acaso": `photoUrl` llega nulo desde la base.
 */
export function PlayerCard({ profile }: { profile: PlayerProfile }) {
  const { category, tournament, stats } = profile;
  const back = categoryPath(category, tournament, "equipos");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={back}
          aria-label="Volver a la categoría"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-muted"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <span className="text-xs font-black tracking-widest text-muted uppercase">Ficha de jugador</span>
        <span className="size-11" aria-hidden />
      </div>

      {/* Móvil: una columna. Desktop: la figurita al lado de sus números. */}
      <div className="md:flex md:items-start md:gap-8">
        <div className="mx-auto w-full max-w-xs shrink-0 md:mx-0">
          <Figurita profile={profile} />
          {profile.photoUrl ? null : (
            <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-muted">
              <Lock className="size-4 shrink-0" aria-hidden />
              La foto se muestra solo con el consentimiento del padre o la madre.
            </p>
          )}
        </div>

        <div className="mt-8 min-w-0 flex-1 space-y-8 md:mt-0">
          <section>
            <h2 className="font-display text-xl tracking-wide uppercase md:text-2xl">{tournament.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {stats.matches} {stats.matches === 1 ? "partido jugado" : "partidos jugados"} ·{" "}
              {category.leagueName} {category.code}
            </p>
            <div className="mt-3 grid grid-cols-4 gap-2 md:gap-3">
              <Tile value={stats.goals} label="Goles" />
              <Tile value={stats.assists} label="Asist." />
              <Tile value={stats.fairPlay} label="Fair play" />
              <Tile value={stats.mvps} label="MVP" />
              {stats.saves > 0 ? <Tile value={stats.saves} label="Atajadas" /> : null}
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl tracking-wide uppercase md:text-2xl">Insignias</h2>
            <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5">
              {profile.badges.map((badge) => (
                <li key={badge.key}>
                  <Badge badge={badge} />
                </li>
              ))}
            </ul>
          </section>

          {profile.otherTournaments.length ? (
            <section>
              <h2 className="font-display text-xl tracking-wide uppercase md:text-2xl">Otros torneos</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {profile.otherTournaments.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/jugadores/${profile.id}?torneo=${t.slug}`}
                      className="flex min-h-11 items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:border-brand-blue"
                    >
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Figurita({ profile }: { profile: PlayerProfile }) {
  const { team, category, stats } = profile;
  const ink = team.secondaryColor;

  return (
    <article
      className="relative overflow-hidden rounded-3xl border-4 border-gold"
      style={{ backgroundColor: team.primaryColor, color: ink }}
    >
      <span
        aria-hidden
        className="absolute -top-10 -right-10 size-48 rounded-full bg-white/20"
      />

      <div className="relative flex items-start justify-between p-5">
        <span className="flex flex-col leading-none">
          <span className="font-display text-6xl">{profile.jerseyNumber}</span>
          {profile.position ? (
            <span className="font-display text-lg" title={profile.position}>
              {profile.position.slice(0, 3).toUpperCase()}
            </span>
          ) : null}
        </span>
        <span
          className="grid size-12 shrink-0 place-items-center rounded-full font-display text-lg"
          style={{ backgroundColor: "var(--navy)", color: team.primaryColor }}
        >
          {(team.shortName ?? team.name).slice(0, 2).toUpperCase()}
        </span>
      </div>

      <div className="relative flex h-52 items-end justify-center">
        {profile.photoUrl ? (
          <img
            src={profile.photoUrl}
            alt={profile.name}
            className="h-52 w-full object-cover object-top"
          />
        ) : (
          <svg viewBox="0 0 96 110" className="h-48 w-auto" role="img" aria-label="Sin foto autorizada">
            <circle cx="48" cy="38" r="22" fill={ink} opacity="0.75" />
            <path d="M8 110c0-26 18-42 40-42s40 16 40 42z" fill={ink} opacity="0.75" />
          </svg>
        )}
      </div>

      <div className="bg-brand-gradient flex items-end justify-between gap-3 p-4 text-white">
        <span className="min-w-0">
          <span className="block truncate font-display text-2xl leading-none">{profile.name}</span>
          <span className="mt-1 block truncate text-xs text-white/70">
            {team.name} · {category.leagueName.replace(" Champions League", "")} {category.code}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-2xl leading-none text-gold">{stats.points}</span>
          <span className="block text-xs text-white/70">puntos</span>
        </span>
      </div>
    </article>
  );
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-border bg-surface py-3">
      <span className="font-display text-2xl leading-none md:text-3xl">{value}</span>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );
}

function Badge({ badge }: { badge: PlayerBadge }) {
  return (
    <span className="flex flex-col items-center gap-1.5 text-center" title={badge.detail}>
      <span
        className={`grid size-14 place-items-center rounded-full border-2 font-display text-base ${
          badge.earned ? "border-gold bg-gold text-navy" : "border-border text-muted"
        }`}
      >
        {badge.short}
      </span>
      <span className={`text-[11px] leading-tight ${badge.earned ? "font-semibold" : "text-muted"}`}>
        {badge.label}
      </span>
      <span className="sr-only">{badge.earned ? `Conseguida: ${badge.detail}` : `Pendiente: ${badge.detail}`}</span>
    </span>
  );
}
