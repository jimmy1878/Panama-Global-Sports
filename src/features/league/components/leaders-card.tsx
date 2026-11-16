import Link from "next/link";
import { Star } from "lucide-react";
import type { Category, LeaderRow, TeamRecognition, Tournament } from "../data";
import { categoryPath } from "../paths";

/** Las tres estadísticas que encabezan la pantalla de categoría. */
const HEADLINE = [
  { stat: "goals", title: "Goles" },
  { stat: "assists", title: "Asistencias" },
  { stat: "saves", title: "Atajadas" },
] as const;

function CardFrame({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-brand-gradient flex flex-col gap-4 rounded-3xl border border-gold/25 p-5 text-white md:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-xl tracking-wide uppercase md:text-2xl">{title}</h2>
        <Link href={href} className="text-sm font-bold text-gold">
          Ver todo
        </Link>
      </div>
      {children}
    </section>
  );
}

/**
 * Tarjeta de líderes: el primero de cada estadística, en grande. Es el resumen
 * que vive junto a la tabla; el ranking completo está en la pestaña Líderes.
 */
export function LeadersCard({
  leaders,
  category,
  tournament,
}: {
  leaders: Record<string, LeaderRow[]>;
  category: Category;
  tournament: Tournament;
}) {
  const tiles = HEADLINE.flatMap(({ stat, title }) => {
    const top = leaders[stat]?.[0];
    return top ? [{ title, top }] : [];
  });
  if (!tiles.length) return null;

  return (
    <CardFrame title="Líderes" href={categoryPath(category, tournament, "lideres")}>
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {tiles.map(({ title, top }) => (
          <Link
            key={title}
            href={`/jugadores/${top.playerId}`}
            className="flex flex-col items-center gap-1 rounded-2xl bg-white/10 p-3 text-center transition-colors hover:bg-white/20"
          >
            <span className="text-[10px] font-black tracking-wide text-gold uppercase md:text-xs">{title}</span>
            <span className="font-display text-3xl leading-none md:text-4xl">{top.value}</span>
            <span className="text-xs font-semibold md:text-sm">{top.playerName}</span>
            <span className="truncate text-[11px] text-white/70">{top.team.name}</span>
          </Link>
        ))}
      </div>
    </CardFrame>
  );
}

/**
 * Lo mismo en las categorías que celebran al equipo (`recognition_mode =
 * 'team_stars'`): las estrellas son del equipo y no hay nombres de niños.
 */
export function TeamStarsCard({
  rows,
  category,
  tournament,
}: {
  rows: TeamRecognition[];
  category: Category;
  tournament: Tournament;
}) {
  const top = [...rows].sort((a, b) => b.stars - a.stars).slice(0, 3);
  if (!top.length) return null;

  return (
    <CardFrame title="Estrellas" href={categoryPath(category, tournament, "lideres")}>
      <ul className="grid grid-cols-3 gap-2 md:gap-3">
        {top.map((r) => (
          <li key={r.team.id}>
            <Link
              href={`/equipos/${r.team.id}`}
              className="flex h-full flex-col items-center gap-1 rounded-2xl bg-white/10 p-3 text-center transition-colors hover:bg-white/20"
            >
              <Star className="size-4 fill-gold text-gold" aria-hidden />
              <span className="font-display text-3xl leading-none md:text-4xl">{r.stars}</span>
              <span className="text-xs font-semibold md:text-sm">{r.team.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </CardFrame>
  );
}
