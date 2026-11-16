import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, Skeleton } from "@/components/ui/section";
import { PlayerCard } from "@/features/league/components/player-card";
import { isUuid } from "@/features/league/data";
import { getPlayerProfile } from "@/features/league/player";
import { getCurrentUser } from "@/lib/auth";

/**
 * Ficha del jugador: la figurita del diseño y el anticipo del álbum.
 *
 * Pide sesión y no se indexa. Los datos que muestra son los públicos de la
 * liga (nombre + inicial, número, equipo, estadísticas), pero una página por
 * niño, abierta y rastreable, es justo lo que la Ley 81 pide evitar.
 */
export const metadata: Metadata = { title: "Ficha de jugador", robots: { index: false } };

export default function JugadorPage({ params, searchParams }: PageProps<"/jugadores/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[36rem] max-w-md" />}>
      {Promise.all([params, searchParams]).then(([p, sp]) => (
        <PlayerProfileContent id={p.id} torneo={one(sp.torneo)} />
      ))}
    </Suspense>
  );
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function PlayerProfileContent({ id, torneo }: { id: string; torneo: string | undefined }) {
  if (!isUuid(id)) notFound();

  const user = await getCurrentUser();
  if (!user) {
    return (
      <EmptyState>
        <span className="flex flex-col items-center gap-3">
          Las fichas de los jugadores son solo para las familias de la liga.
          <a
            href={`/ingresar?next=${encodeURIComponent(`/jugadores/${id}`)}`}
            className="flex min-h-11 items-center rounded-xl bg-brand-blue px-5 font-semibold text-white"
          >
            Ingresar
          </a>
        </span>
      </EmptyState>
    );
  }

  const profile = await getPlayerProfile(id, torneo);
  if (!profile) notFound();

  return <PlayerCard profile={profile} />;
}
