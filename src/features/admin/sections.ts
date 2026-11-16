import { BadgeDollarSign, CalendarRange, Gauge, House, Images, Layers, MapPin, Shield, Sparkles, Swords, UserCog } from "lucide-react";

/** Secciones del panel. Archivo neutro (sin "use client"): lo usan componentes de servidor y de navegador. */
export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Resumen", icon: Gauge },
  { href: "/admin/torneos", label: "Torneos", icon: CalendarRange },
  { href: "/admin/categorias", label: "Ligas y categorías", icon: Layers },
  { href: "/admin/equipos", label: "Equipos y jugadores", icon: Shield },
  { href: "/admin/partidos", label: "Partidos", icon: Swords },
  { href: "/admin/cronicas", label: "Crónicas", icon: Sparkles },
  { href: "/admin/galeria", label: "Galería", icon: Images },
  { href: "/admin/patrocinios", label: "Patrocinadores", icon: BadgeDollarSign },
  { href: "/admin/familias", label: "Familias", icon: House },
  { href: "/admin/usuarios", label: "Usuarios y roles", icon: UserCog },
  { href: "/admin/canchas", label: "Canchas", icon: MapPin },
] as const;
