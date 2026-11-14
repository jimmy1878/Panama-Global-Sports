import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { isUuid } from "@/features/league/data";
import { CARD_FORMATS, isCardFormat, ResultCard } from "@/features/share/card";
import { getCardData } from "@/features/share/data";

/**
 * Tarjeta de resultado en PNG para compartir:
 *   /partidos/<id>/tarjeta?formato=historia   1080×1350 (Instagram)
 *   /partidos/<id>/tarjeta?formato=cuadrada   1080×1080 (WhatsApp)
 *
 * Solo usa datos públicos del partido. Las fuentes se leen una vez al cargar
 * el módulo (no dependen de la petición) y van en `assets/fonts`; están en
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

/** Un partido en vivo cambia a cada gol; uno terminado ya casi no cambia. */
function cacheControl(status: string) {
  const seconds = status === "live" ? 30 : status === "finished" ? 300 : 600;
  return `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=86400`;
}

export async function GET(request: NextRequest, ctx: RouteContext<"/partidos/[id]/tarjeta">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Partido no encontrado", { status: 404 });

  const formato = request.nextUrl.searchParams.get("formato");
  const format = isCardFormat(formato) ? formato : "historia";

  const data = await getCardData(id, format);
  if (!data) return new Response("Partido no encontrado", { status: 404 });

  const { width, height } = CARD_FORMATS[format];
  return new ImageResponse(ResultCard(data), {
    width,
    height,
    fonts: [...FONTS],
    headers: { "Cache-Control": cacheControl(data.status) },
  });
}
