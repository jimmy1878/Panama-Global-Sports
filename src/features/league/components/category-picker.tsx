import Link from "next/link";
import type { Category } from "../data";

/**
 * Selector de categoría con enlaces (?cat=boys-u10): funciona sin JavaScript.
 * Móvil: una fila deslizable por liga. Desktop: grupos en línea.
 */
export function CategoryPicker({
  categories,
  current,
  basePath,
}: {
  categories: Category[];
  current: Category;
  basePath: string;
}) {
  const leagues = [...new Map(categories.map((c) => [c.leagueId, c.leagueName])).entries()];

  return (
    <nav aria-label="Categoría" className="mb-5 space-y-3 md:flex md:flex-wrap md:gap-x-8 md:gap-y-3 md:space-y-0">
      {leagues.map(([leagueId, leagueName]) => (
        <div key={leagueId}>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{leagueName}</p>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {categories
              .filter((c) => c.leagueId === leagueId)
              .map((c) => {
                const active = c.id === current.id;
                return (
                  <li key={c.id}>
                    <Link
                      href={`${basePath}?cat=${c.key}`}
                      scroll={false}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-10 min-w-14 items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                        active
                          ? "border-brand-blue bg-brand-blue text-white"
                          : "border-border bg-surface text-foreground hover:border-brand-blue"
                      }`}
                    >
                      {c.code}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
