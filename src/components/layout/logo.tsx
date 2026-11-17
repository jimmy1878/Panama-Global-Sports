import Image from "next/image";
import Link from "next/link";

/**
 * Logotipo de Panama Global Sports.
 *
 * Desde el 2026-11-16 el archivo tiene **fondo transparente**, así que se ve
 * bien sobre navy y también sobre claro —el dorado lleva su propio contorno
 * oscuro—. El anterior traía el navy difuminado encima y solo servía sobre
 * `bg-brand-gradient`; si ves esa restricción escrita en algún lado, está vieja.
 *
 * Los dos archivos salen del maestro `assets/brand/logo-fuente.webp`, que no se
 * publica: `logo.webp` es el bloque completo y `isotipo.webp` solo el globo. En
 * móvil va el globo, porque el bloque entero no se leería a ese tamaño.
 */
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Panama Global Sports, inicio">
      {/* Móvil: el globo */}
      <Image
        src="/brand/isotipo.webp"
        alt=""
        width={178}
        height={160}
        priority
        className="h-9 w-auto md:hidden"
      />
      {/* Desktop: el bloque completo */}
      <Image
        src="/brand/logo.webp"
        alt=""
        width={980}
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
