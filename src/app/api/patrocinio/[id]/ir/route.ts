import { NextResponse } from "next/server";
import { isUuid } from "@/features/league/data";
import { getPlacementLink, recordSponsorEvent } from "@/features/sponsors/data";

/**
 * Un clic: se cuenta ANTES de redirigir, como pide la especificación, y el
 * destino se lee de la base, no de la URL. Así nadie puede usar la liga como
 * trampolín hacia cualquier sitio.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/patrocinio/[id]/ir">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("No encontrado", { status: 404 });

  const link = await getPlacementLink(id);
  if (!link || !isHttpUrl(link)) return new Response("Este patrocinador no tiene enlace", { status: 404 });

  await recordSponsorEvent(id, "click");
  return NextResponse.redirect(link, 302);
}

/** Solo http(s): un `javascript:` o un `data:` guardado por error no se abre. */
function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
