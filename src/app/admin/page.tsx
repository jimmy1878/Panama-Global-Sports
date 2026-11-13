import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { EmptyState, PageTitle } from "@/components/ui/section";
import { getDashboardCounts } from "@/features/admin/data";
import { getCurrentSeason } from "@/features/league/data";
import { ADMIN_SECTIONS } from "@/features/admin/sections";

export default async function AdminHome() {
  const season = await getCurrentSeason();
  if (!season) {
    return (
      <>
        <PageTitle title="Administración" />
        <EmptyState>
          No hay temporada actual. <Link href="/admin/temporadas" className="font-semibold text-brand-blue">Crea o marca una temporada</Link>.
        </EmptyState>
      </>
    );
  }
  const counts = await getDashboardCounts(season.id);

  const stats = [
    { label: "Equipos", value: counts.teams, href: "/admin/equipos" },
    { label: "Jugadores", value: counts.players, href: "/admin/equipos" },
    { label: "Partidos", value: counts.matches, href: "/admin/partidos" },
    { label: "Familias", value: counts.families, href: "/admin/familias" },
    { label: "Usuarios", value: counts.users, href: "/admin/usuarios" },
  ];

  return (
    <div className="space-y-6">
      <PageTitle title="Administración" subtitle={season.name} />

      {counts.withoutOfficial > 0 ? (
        <Link
          href="/admin/partidos"
          className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <span className="flex-1">
            <strong>{counts.withoutOfficial}</strong> partidos programados sin delegado o árbitro asignado.
          </span>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-2xl border border-border bg-surface p-4 hover:border-brand-blue">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="mt-1 text-2xl font-black tabular-nums">{s.value}</dd>
          </Link>
        ))}
      </dl>

      {/* Móvil: accesos grandes a cada sección (en desktop está la barra lateral) */}
      <ul className="grid gap-3 md:hidden">
        {ADMIN_SECTIONS.slice(1).map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex h-14 items-center gap-3 rounded-2xl border border-border bg-surface px-4 font-medium">
              <Icon className="size-5 text-brand-blue" aria-hidden />
              <span className="flex-1">{label}</span>
              <ChevronRight className="size-4 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
