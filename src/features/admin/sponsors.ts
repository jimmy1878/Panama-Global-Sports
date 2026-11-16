import "server-only";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sponsorLogoUrl } from "@/lib/supabase/public";
import type { SponsorScope } from "@/features/sponsors/pick";

/**
 * Lo que necesita la pantalla de patrocinios, en una sola lectura.
 *
 * Como en el resto del panel, se verifica el rol ANTES de consultar: Next
 * ejecuta el layout y la página en paralelo, así que el guardia del layout no
 * basta.
 */

export type ScopeOption = { value: string; label: string; group: string };

export async function getSponsorshipAdmin() {
  await requireRole(["admin"], "/admin");
  const supabase = await createClient();

  const [
    { data: sponsors },
    { data: tiers },
    { data: slots },
    { data: contracts },
    { data: placements },
    { data: report },
  ] = await Promise.all([
    supabase.from("sponsors").select("*").order("name"),
    supabase.from("sponsorship_tiers").select("*").order("sort_order"),
    supabase.from("sponsorship_slots").select("*").order("sort_order"),
    supabase
      .from("sponsorship_contracts")
      .select("*, sponsor:sponsors(name), tier:sponsorship_tiers(name)")
      .order("starts_on", { ascending: false }),
    supabase
      .from("sponsorship_placements")
      .select("*, slot:sponsorship_slots(code, name)")
      .order("starts_on", { ascending: false }),
    supabase.from("sponsorship_contract_report").select("*"),
  ]);

  const metrics = new Map(
    (report ?? []).map((r) => [r.contract_id, { impressions: Number(r.impressions ?? 0), clicks: Number(r.clicks ?? 0) }]),
  );

  return {
    sponsors: (sponsors ?? []).map((s) => ({ ...s, logoUrl: sponsorLogoUrl(s.logo_path) })),
    tiers: tiers ?? [],
    slots: slots ?? [],
    contracts: (contracts ?? []).map((c) => ({
      ...c,
      sponsorName: c.sponsor?.name ?? "",
      tierName: c.tier?.name ?? "",
      ...(metrics.get(c.id) ?? { impressions: 0, clicks: 0 }),
    })),
    placements: (placements ?? []).map((p) => ({
      ...p,
      slotCode: p.slot?.code ?? "",
      slotName: p.slot?.name ?? "",
    })),
    scopes: await getScopeOptions(),
  };
}

/**
 * Todos los ámbitos vendibles, en un solo desplegable: "liga:<uuid>".
 * Es un campo en vez de dos porque el tipo y la fila van siempre juntos.
 */
async function getScopeOptions(): Promise<ScopeOption[]> {
  const supabase = await createClient();
  const [{ data: orgs }, { data: leagues }, { data: circuits }, { data: tournaments }, { data: categories }] =
    await Promise.all([
      supabase.from("organizations").select("id, name"),
      supabase.from("leagues").select("id, name").order("sort_order"),
      supabase.from("circuits").select("id, name").order("sort_order"),
      supabase.from("tournaments").select("id, name, league:leagues(name)").order("starts_on", { ascending: false }),
      supabase
        .from("categories")
        .select("id, code, league:leagues(name)")
        .order("sort_order"),
    ]);

  const option = (scope: SponsorScope, id: string, label: string, group: string): ScopeOption => ({
    value: `${scope}:${id}`,
    label,
    group,
  });

  return [
    ...(orgs ?? []).map((o) => option("organizacion", o.id, o.name, "Toda la organización")),
    ...(leagues ?? []).map((l) => option("liga", l.id, l.name, "Ligas")),
    ...(circuits ?? []).map((c) => option("circuito", c.id, c.name, "Circuitos")),
    ...(tournaments ?? []).map((t) =>
      option("torneo", t.id, `${t.league?.name?.replace(" Champions League", "") ?? ""} · ${t.name}`, "Torneos"),
    ),
    ...(categories ?? []).map((c) =>
      option("categoria", c.id, `${c.league?.name?.replace(" Champions League", "") ?? ""} ${c.code}`, "Categorías"),
    ),
  ];
}
