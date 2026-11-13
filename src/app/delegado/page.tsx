import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { EmptyState, PageTitle, Skeleton } from "@/components/ui/section";
import { getMyMatches } from "@/features/live/data";
import { formatDay, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Marcador en vivo", robots: { index: false } };

export default function DelegadoPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Marcador en vivo" subtitle="Tus partidos asignados. Toca uno para abrir el marcador." />
      <Suspense fallback={<Skeleton className="h-72" />}>
        <MatchList />
      </Suspense>
    </div>
  );
}

const STATUS_LABEL = { scheduled: "Programado", live: "EN VIVO", finished: "Finalizado", postponed: "Aplazado", cancelled: "Cancelado" };

async function MatchList() {
  const { user, matches } = await getMyMatches();
  if (!matches.length) {
    return (
      <EmptyState>
        {user.role === "admin"
          ? "No hay partidos hoy ni en vivo, y no tienes partidos asignados."
          : "No tienes partidos asignados. Un administrador te los asigna en el panel."}
      </EmptyState>
    );
  }

  // En vivo primero, luego próximos y al final los terminados
  const order = { live: 0, scheduled: 1, postponed: 2, finished: 3, cancelled: 4 } as const;
  const sorted = [...matches].sort((a, b) => order[a.status] - order[b.status] || a.starts_at.localeCompare(b.starts_at));

  return (
    <ul className="space-y-3">
      {sorted.map((m) => (
        <li key={m.id}>
          <Link
            href={`/delegado/partidos/${m.id}`}
            className={`flex items-center gap-3 rounded-2xl border bg-surface p-4 active:bg-surface-muted ${
              m.status === "live" ? "border-brand-red" : "border-border"
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs text-muted">
                <strong className="text-foreground">{m.category?.code}</strong>
                {formatDay(m.starts_at)} · {formatTime(m.starts_at)}
                <span className={m.status === "live" ? "font-bold text-brand-red" : ""}>· {STATUS_LABEL[m.status]}</span>
              </span>
              <span className="mt-1 block truncate font-semibold">
                {m.home.name} {m.home_score !== null ? `${m.home_score} – ${m.away_score}` : "vs"} {m.away.name}
              </span>
              {m.venue ? (
                <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                  <MapPin className="size-3.5" aria-hidden />
                  {m.venue.name}
                </span>
              ) : null}
            </span>
            <ChevronRight className="size-5 text-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
