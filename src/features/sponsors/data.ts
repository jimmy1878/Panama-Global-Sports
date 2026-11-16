import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient, sponsorLogoUrl } from "@/lib/supabase/public";
import type { SponsorPlacement, SponsorScope } from "./pick";

/**
 * Lo que hay vigente HOY para pintar. Una sola consulta para toda la página:
 * son pocas filas (un puñado de asignaciones activas) y así un espacio más no
 * cuesta una consulta más.
 *
 * La vista `active_sponsor_placements` ya filtra por fecha (en hora de Panamá)
 * y por contrato activo, y no devuelve montos ni contactos.
 */
export async function getActiveSponsors(): Promise<SponsorPlacement[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("sponsors");

  const { data, error } = await createPublicClient()
    .from("active_sponsor_placements")
    .select("id, slot_code, scope, scope_id, priority, rotation_weight, text, link_url, image_path, logo_dark_path, sponsor_name");
  if (error || !data) return []; // un espacio sin patrocinador no se muestra: tampoco si falla

  return data.flatMap((row) => {
    if (!row.id || !row.slot_code || !row.scope || !row.scope_id) return [];
    return [
      {
        id: row.id,
        slotCode: row.slot_code,
        scope: row.scope as SponsorScope,
        scopeId: row.scope_id,
        priority: row.priority ?? 0,
        rotationWeight: row.rotation_weight ?? 1,
        text: row.text,
        linkUrl: row.link_url,
        imageUrl: sponsorLogoUrl(row.image_path),
        logoDarkUrl: sponsorLogoUrl(row.logo_dark_path),
        sponsorName: row.sponsor_name ?? "",
      },
    ];
  });
}

/** El destino de un clic, para la ruta que cuenta y redirige. */
export async function getPlacementLink(placementId: string): Promise<string | null> {
  const { data } = await createPublicClient()
    .from("active_sponsor_placements")
    .select("link_url")
    .eq("id", placementId)
    .maybeSingle();
  return data?.link_url ?? null;
}

/** Suma una impresión o un clic. Nunca falla hacia fuera: es telemetría. */
export async function recordSponsorEvent(placementId: string, kind: "impression" | "click") {
  try {
    await createPublicClient().rpc("record_sponsor_event", {
      p_placement: placementId,
      p_kind: kind,
    });
  } catch {
    // Si la métrica se pierde, la página sigue funcionando.
  }
}
