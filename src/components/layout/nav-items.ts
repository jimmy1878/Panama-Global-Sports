import {
  CalendarDays,
  ChartColumn,
  House,
  Menu,
  Shield,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Navegación principal. Móvil (BottomNav) y desktop (SiteHeader) usan esta misma lista. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/equipos", label: "Equipos", icon: Shield },
  { href: "/estadisticas", label: "Estadísticas", icon: ChartColumn },
  { href: "/mas", label: "Más", icon: Menu },
];

export function isActive(pathname: string | undefined, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
