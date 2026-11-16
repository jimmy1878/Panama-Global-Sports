/**
 * Rutas de la liga. Archivo neutro (sin "use client" ni "server-only") para
 * que lo puedan importar tanto componentes de servidor como de cliente.
 *
 * La pantalla central es la categoría dentro de un torneo:
 *   /ligas/boys/academias-clausura-2026/u10
 */

/** Vistas de la pantalla de categoría, en el orden de las pestañas. */
export const CATEGORY_VIEWS = [
  { key: "tabla", label: "Tabla" },
  { key: "calendario", label: "Calendario" },
  { key: "resultados", label: "Resultados" },
  { key: "lideres", label: "Líderes" },
  { key: "equipos", label: "Equipos" },
] as const;

export type CategoryView = (typeof CATEGORY_VIEWS)[number]["key"];

export function resolveView(value: string | string[] | undefined): CategoryView {
  const wanted = Array.isArray(value) ? value[0] : value;
  return CATEGORY_VIEWS.find((v) => v.key === wanted)?.key ?? "tabla";
}

export function categoryPath(
  category: { leagueGender: string; code: string },
  tournament: { slug: string },
  view: CategoryView = "tabla",
) {
  const base = `/ligas/${category.leagueGender}/${tournament.slug}/${category.code.toLowerCase()}`;
  return view === "tabla" ? base : `${base}?v=${view}`;
}
