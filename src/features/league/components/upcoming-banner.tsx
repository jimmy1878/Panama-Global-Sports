import Link from "next/link";
import { CalendarClock } from "lucide-react";
import type { Tournament } from "@/features/league/data";
import { formatDateOnly } from "@/lib/format";

/**
 * Banner del próximo torneo mientras tiene inscripciones abiertas: en la liga
 * es, típicamente, la Copa de Navidad.
 *
 * Los días que faltan se calculan en el servidor a partir de la fecha de
 * cierre; no hay reloj en el navegador, porque un número que baja al segundo
 * no aporta nada y sí da problemas de hidratación.
 */
export function UpcomingBanner({ tournaments }: { tournaments: Tournament[] }) {
  if (!tournaments.length) return null;

  // Si Boys y Girls abren la misma copa, se anuncia una vez
  const [first] = tournaments;
  const leagues = tournaments.map((t) => t.leagueName.replace(" Champions League", ""));
  const dias = diasHasta(first.registrationClosesOn);

  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-girls p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
      <div className="flex flex-col gap-2">
        <span className="self-start rounded-full bg-gold px-3 py-1 text-[11px] font-black tracking-widest text-navy uppercase">
          Próximo torneo · Inscripciones abiertas
        </span>
        <h2 className="font-display text-3xl leading-tight uppercase md:text-4xl">
          {first.typeName} {first.year}
        </h2>
        <p className="text-sm md:text-base">
          {first.circuitName}
          {leagues.length > 1 ? `, para ${leagues.join(" y ")}` : ` · ${first.leagueName}`}. Del{" "}
          {formatDateOnly(first.startsOn)} al {formatDateOnly(first.endsOn)}.
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
        {dias !== null ? (
          <span className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2.5 text-sm font-bold">
            <CalendarClock className="size-4" aria-hidden />
            {dias > 0
              ? `Quedan ${dias} ${dias === 1 ? "día" : "días"} para inscribirse`
              : "Las inscripciones cierran hoy"}
          </span>
        ) : null}
        <Link
          href="/mas"
          className="flex min-h-12 items-center rounded-xl bg-gold px-6 font-display text-lg tracking-wide text-navy uppercase"
        >
          Inscribir un equipo
        </Link>
      </div>
    </section>
  );
}

/** Días completos hasta la fecha de cierre, en hora de Panamá. */
function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  const cierre = Date.parse(`${fecha}T23:59:59-05:00`);
  if (Number.isNaN(cierre)) return null;
  const dias = Math.ceil((cierre - Date.now()) / 86_400_000);
  return dias >= 0 ? dias : null;
}
