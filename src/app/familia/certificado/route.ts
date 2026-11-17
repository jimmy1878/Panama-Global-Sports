import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { after, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { Certificate, CERTIFICATE_PAGE_PT, CERTIFICATE_SIZE } from "@/features/certificates/certificate";
import { getCertificateData } from "@/features/certificates/data";
import { isUuid } from "@/features/league/data";
import { recordSponsorEvent } from "@/features/sponsors/data";

/**
 * Certificado en PDF de un hijo en un torneo finalizado:
 *   /familia/certificado?jugador=<uuid>&torneo=<uuid>
 *
 * Solo lo descarga la familia vinculada: la vista
 * `my_family_tournament_certificates` no devuelve nada a nadie más, así que el
 * permiso lo impone la base y no esta ruta.
 *
 * El dibujo lo hace Satori (`next/og`) y `pdf-lib` mete esa imagen en una
 * página de tamaño carta horizontal. Es una imagen y no texto seleccionable a
 * propósito: lo que se busca aquí es que se imprima igual en cualquier parte.
 *
 * Las fuentes se leen una vez al cargar el módulo y están en
 * `outputFileTracingIncludes` para que Vercel las despliegue con la función.
 */

const FONTS_DIR = join(process.cwd(), "assets", "fonts");

const [medium, bold, black] = await Promise.all([
  readFile(join(FONTS_DIR, "Geist-Medium.ttf")),
  readFile(join(FONTS_DIR, "Geist-Bold.ttf")),
  readFile(join(FONTS_DIR, "Geist-Black.ttf")),
]);

const FONTS = [
  { name: "Geist", data: medium, weight: 500, style: "normal" },
  { name: "Geist", data: bold, weight: 700, style: "normal" },
  { name: "Geist", data: black, weight: 900, style: "normal" },
] as const;

/**
 * El logotipo para la banda de arriba, también una sola vez al cargar el módulo.
 *
 * Sale del maestro `assets/brand/logo-fuente.webp` —cuyo contenido vive en
 * x 27–1986, y 160–479; el resto es transparente y dejaría la banda
 * descentrada— y se convierte a PNG porque **Satori no lee WebP**. Va al doble
 * del tamaño al que se dibuja, para que no se vea blando al imprimir.
 *
 * Si algo falla devuelve null y la plantilla cae al nombre en texto: una
 * familia no se queda sin su certificado por culpa de un logo.
 */
const BRAND_LOGO = await (async () => {
  try {
    const png = await sharp(join(process.cwd(), "assets", "brand", "logo-fuente.webp"))
      .extract({ left: 27, top: 160, width: 1960, height: 320 })
      .resize({ height: 236 })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
})();

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("jugador");
  const tournamentId = request.nextUrl.searchParams.get("torneo");
  if (!playerId || !tournamentId || !isUuid(playerId) || !isUuid(tournamentId)) {
    return new Response("Certificado no encontrado", { status: 404 });
  }

  const certificate = await getCertificateData(playerId, tournamentId);
  if (!certificate) return new Response("Certificado no encontrado", { status: 404 });

  const png = await new ImageResponse(Certificate({ ...certificate.data, brandLogo: BRAND_LOGO }), {
    ...CERTIFICATE_SIZE,
    fonts: [...FONTS],
  }).arrayBuffer();

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificado · ${certificate.data.name}`);
  pdf.setCreator("Panama Global Sports");
  pdf.setProducer("Panama Global Sports");
  const page = pdf.addPage([CERTIFICATE_PAGE_PT.width, CERTIFICATE_PAGE_PT.height]);
  page.drawImage(await pdf.embedPng(png), {
    x: 0,
    y: 0,
    width: CERTIFICATE_PAGE_PT.width,
    height: CERTIFICATE_PAGE_PT.height,
  });

  // El espacio del certificado se cobra como cualquier otro: una impresión por
  // descarga. Va después de responder para no hacer esperar a nadie.
  const placementId = certificate.sponsorPlacementId;
  if (placementId) after(() => recordSponsorEvent(placementId, "impression"));

  return new Response(new Uint8Array(await pdf.save()), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${certificate.fileName}.pdf"`,
      // Es de una familia: ni el navegador ni la CDN deben guardarlo.
      "Cache-Control": "private, no-store",
    },
  });
}
