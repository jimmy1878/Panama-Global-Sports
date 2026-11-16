import { connection } from "next/server";
import { getActiveSponsors } from "./data";
import { pickSponsor, type SponsorContext, type SponsorSlotCode } from "./pick";
import { SponsorBanner, type SponsorTone, type SponsorVariant } from "./banner";

/**
 * Un espacio de patrocinio. Si nadie lo tiene comprado hoy, no se pinta nada:
 * no hay hueco, ni "disponible", ni borde vacío.
 *
 * `connection()` lo marca como dinámico a propósito. Si se prerenderizara, la
 * rotación entre varios patrocinadores quedaría congelada en el build y uno
 * solo se llevaría todas las impresiones.
 *
 * Va siempre dentro de un <Suspense>, como todo lo dinámico con Cache Components.
 */
export async function SponsorSlot({
  code,
  context,
  variant = "header",
  tone = "dark",
  className,
}: {
  code: SponsorSlotCode;
  context: SponsorContext;
  variant?: SponsorVariant;
  tone?: SponsorTone;
  className?: string;
}) {
  await connection();
  const placement = pickSponsor(await getActiveSponsors(), code, context);
  if (!placement) return null;
  return <SponsorBanner placement={placement} variant={variant} tone={tone} className={className} />;
}
