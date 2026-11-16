import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Category, Tournament } from "@/features/league/data";

/**
 * Una tarjeta por liga con su torneo actual y sus categorías. Si la liga tiene
 * dos torneos a la vez (Academias y Escolares), el segundo aparece como
 * "también en curso": pasa a propósito y el diseño lo contempla.
 */
export function TournamentCards({
  tournaments,
  categoriesByTournament,
  progress,
}: {
  tournaments: Tournament[];
  categoriesByTournament: Record<string, Category[]>;
  progress: Record<string, { played: number; total: number }>;
}) {
  // Agrupadas por liga, conservando el orden en que vienen
  const byLeague = new Map<string, Tournament[]>();
  for (const t of tournaments) {
    byLeague.set(t.leagueId, [...(byLeague.get(t.leagueId) ?? []), t]);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-5">
      {[...byLeague.values()].map((ofLeague) => {
        const [main, ...also] = ofLeague;
        const girls = main.leagueName.toLowerCase().includes("girls");
        const categories = categoriesByTournament[main.id] ?? [];
        const done = progress[main.id];

        return (
          <article
            key={main.leagueId}
            className="flex flex-col gap-4 rounded-3xl p-5 md:p-6"
            style={{ backgroundColor: girls ? "var(--girls)" : "var(--boys)" }}
          >
            <div className={girls ? "text-white" : "text-navy"}>
              <p className="text-xs font-black tracking-widest uppercase opacity-80">Torneo actual</p>
              <h3 className="font-display text-2xl leading-tight md:text-3xl">{main.leagueName}</h3>
              <p className="mt-1 font-display text-lg md:text-xl">{main.name}</p>
              {done && done.total > 0 ? (
                <span className="mt-2 inline-block rounded-full bg-gold px-3 py-1 text-xs font-black text-navy">
                  Jornada {Math.min(done.played + 1, done.total)} de {done.total}
                </span>
              ) : null}
            </div>

            {also.map((other) => (
              <Link
                key={other.id}
                href={`/calendario?torneo=${other.slug}`}
                className={`flex items-center justify-between gap-2 rounded-xl bg-white/35 px-3 py-2.5 text-sm font-bold ${
                  girls ? "text-white" : "text-navy"
                }`}
              >
                <span>
                  <span className="text-[11px] font-black tracking-widest uppercase">También en curso · </span>
                  {other.name}
                </span>
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Link>
            ))}

            {categories.length ? (
              <ul className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={`/estadisticas?cat=${category.key}&torneo=${main.slug}`}
                      className="grid min-h-11 min-w-16 place-items-center rounded-xl bg-white px-3 font-display text-lg"
                      style={{ color: girls ? "var(--girls)" : "var(--navy)" }}
                    >
                      {category.code}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            <div
              className={`flex flex-wrap gap-4 text-sm font-bold ${girls ? "text-white" : "text-navy"}`}
            >
              <Link href={`/calendario?torneo=${main.slug}`} className="underline-offset-4 hover:underline">
                Calendario
              </Link>
              <Link href={`/estadisticas?torneo=${main.slug}`} className="underline-offset-4 hover:underline">
                Tablas
              </Link>
              <Link href={`/equipos?torneo=${main.slug}`} className="underline-offset-4 hover:underline">
                Equipos
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
