import { PawPrint, Recycle } from "lucide-react";

/**
 * Cómo se vive un torneo, más allá del resultado.
 *
 * Va en la portada, antes del banner de inscripciones: es lo que una familia
 * quiere saber cuando está decidiendo si viene, y leerlo justo antes del botón
 * de inscribirse es lo que le da sentido.
 *
 * El texto está escrito acá y no en la base a propósito: son valores de la
 * organización, iguales para todos los torneos. El día que cambien por torneo
 * —un circuito donde no se puedan llevar mascotas, por ejemplo— esto deja de
 * ser un componente fijo y pasa a ser un campo.
 *
 * No agregar aquí nada que no se cumpla en la cancha. Una familia que llega con
 * su perro porque lo leyó acá y se encuentra con que no puede entrar se va con
 * una impresión peor que si nunca lo hubiéramos dicho.
 */
const VALUES = [
  {
    icon: PawPrint,
    title: "Pet friendly",
    text: "Tu mascota es bienvenida. Pueden venir con la familia a acompañar a los niños.",
  },
  {
    icon: Recycle,
    title: "Apoyamos el reciclaje",
    text: "Promovemos el reciclaje en cada torneo y cuidamos la cancha que nos presta la comunidad.",
  },
];

export function LeagueValues() {
  return (
    <section className="rounded-3xl border border-border bg-surface p-6 md:p-8">
      <h2 className="font-display text-xl tracking-wide uppercase md:text-2xl">Así son nuestros torneos</h2>
      <ul className="mt-5 grid gap-5 md:grid-cols-2 md:gap-8">
        {VALUES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-4">
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold/20 text-brand-blue">
              <Icon className="size-6" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-bold">{title}</p>
              <p className="text-sm text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
