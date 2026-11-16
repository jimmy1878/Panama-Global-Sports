import { isUuid } from "@/features/league/data";
import { recordSponsorEvent } from "@/features/sponsors/data";

/**
 * Una impresión: el logo se mostró. Lo llama el navegador con `sendBeacon`,
 * así que la respuesta no le interesa a nadie y nunca devuelve un error que
 * ensucie la consola del visitante.
 *
 * La base solo cuenta si la asignación está vigente hoy, y de un id inventado
 * no sale nada.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/patrocinio/[id]/vista">) {
  const { id } = await ctx.params;
  if (isUuid(id)) await recordSponsorEvent(id, "impression");
  return new Response(null, { status: 204 });
}
