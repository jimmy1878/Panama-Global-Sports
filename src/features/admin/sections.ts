import { CalendarRange, Gauge, House, MapPin, Shield, Swords, UserCog } from "lucide-react";

/** Secciones del panel. Archivo neutro (sin "use client"): lo usan componentes de servidor y de navegador. */
export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Resumen", icon: Gauge },
  { href: "/admin/temporadas", label: "Temporadas", icon: CalendarRange },
  { href: "/admin/equipos", label: "Equipos y jugadores", icon: Shield },
  { href: "/admin/partidos", label: "Partidos", icon: Swords },
  { href: "/admin/familias", label: "Familias", icon: House },
  { href: "/admin/usuarios", label: "Usuarios y roles", icon: UserCog },
  { href: "/admin/canchas", label: "Canchas", icon: MapPin },
] as const;
