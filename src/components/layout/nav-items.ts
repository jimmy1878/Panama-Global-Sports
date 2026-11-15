import {
  CalendarDays,
  ChartColumn,
  House,
  Images,
  Menu,
  Radio,
  Shield,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Está en el diseño pero la pantalla todavía no existe: se muestra apagado. */
  soon?: boolean;
};

/**
 * Menú superior (desktop): el del diseño. Álbum y Fantasy son fases futuras e
 * Historial está sin construir, así que aparecen apagados en vez de llevar a
 * una página vacía.
 */
export const DESKTOP_NAV: NavItem[] = [
  { href: "/equipos", label: "Torneos", icon: Trophy },
  { href: "/#en-vivo", label: "En vivo", icon: Radio },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/galeria", label: "Galería", icon: Images },
  { href: "/album", label: "Álbum", icon: Shield, soon: true },
  { href: "/fantasy", label: "Fantasy", icon: ChartColumn, soon: true },
  { href: "/historial", label: "Historial", icon: House, soon: true },
];

/** Menú inferior (móvil): cinco destinos, los que de verdad se usan a diario. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/equipos", label: "Equipos", icon: Shield },
  { href: "/estadisticas", label: "Estadísticas", icon: ChartColumn },
  { href: "/mas", label: "Más", icon: Menu },
];

export function isActive(pathname: string | undefined, href: string) {
  if (!pathname) return false;
  const path = href.split("#")[0];
  if (!path || path === "/") return pathname === "/";
  return pathname.startsWith(path);
}
