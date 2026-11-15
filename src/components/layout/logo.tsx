import Image from "next/image";
import Link from "next/link";

/**
 * Logotipo de Panama Global Sports.
 *
 * El archivo trae el fondo navy difuminado con el que fue diseñado, así que
 * solo se ve bien sobre el degradado de marca (`bg-brand-gradient`), nunca
 * sobre blanco. En móvil se usa solo el globo: el bloque completo no se leería.
 */
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Panama Global Sports, inicio">
      {/* Móvil: el globo */}
      <Image
        src="/brand/isotipo.webp"
        alt=""
        width={146}
        height={160}
        priority
        className="h-9 w-auto md:hidden"
      />
      {/* Desktop: el bloque completo */}
      <Image
        src="/brand/logo.webp"
        alt=""
        width={541}
        height={160}
        priority
        className="hidden h-11 w-auto md:block"
      />
      <span aria-hidden className="leading-tight md:hidden">
        <span className="block font-display text-base text-gold">PANAMA GLOBAL SPORTS</span>
        <span className="block text-[11px] font-medium text-white/70">Ligas infantiles</span>
      </span>
    </Link>
  );
}
