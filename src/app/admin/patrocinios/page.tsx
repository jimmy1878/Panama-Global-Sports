/* eslint-disable @next/next/no-img-element -- logos del bucket público, pequeños */
import type { Metadata } from "next";
import { PageTitle, Section } from "@/components/ui/section";
import { getSponsorshipAdmin, type ScopeOption } from "@/features/admin/sponsors";
import { AdminForm, Field, Select, TextInput } from "@/features/admin/form";
import { formatDateOnly } from "@/lib/format";
import {
  createContract,
  createPlacement,
  createSponsor,
  deletePlacement,
  setContractStatus,
} from "./actions";

export const metadata: Metadata = { title: "Patrocinadores" };

const STATUS_STYLE: Record<string, string> = {
  activo: "bg-fair text-navy",
  borrador: "bg-surface-muted text-muted",
  vencido: "bg-navy text-white",
};

export default async function SponsorsAdminPage() {
  const { sponsors, tiers, slots, contracts, placements, scopes } = await getSponsorshipAdmin();
  const scopeLabel = new Map(scopes.map((s) => [s.value, s.label]));
  const activos = contracts.filter((c) => c.status === "activo");

  return (
    <div className="space-y-8">
      <PageTitle
        title="Patrocinadores"
        subtitle="No aparecen en la portada. Aquí decides en qué espacios internos se ve cada uno y entre qué fechas."
      />

      <Section title={`Contratos (${contracts.length})`}>
        {contracts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] overflow-hidden rounded-2xl border border-border bg-surface text-sm">
              <thead className="bg-surface-muted text-left text-xs text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Patrocinador</th>
                  <th className="px-4 py-3 font-semibold">Nivel</th>
                  <th className="px-4 py-3 font-semibold">Vigencia</th>
                  <th className="px-4 py-3 text-right font-semibold">Impresiones</th>
                  <th className="px-4 py-3 text-right font-semibold">Clics</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contracts.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-semibold">{c.sponsorName}</td>
                    <td className="px-4 py-3 text-muted">{c.tierName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDateOnly(c.starts_on)} – {formatDateOnly(c.ends_on)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.impressions.toLocaleString("es-PA")}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.clicks.toLocaleString("es-PA")}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`mb-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${
                          STATUS_STYLE[c.status] ?? ""
                        }`}
                      >
                        {c.status}
                      </span>
                      <AdminForm action={setContractStatus} submitLabel="Cambiar" compact>
                        <input type="hidden" name="id" value={c.id} />
                        <Select name="status" defaultValue={c.status}>
                          <option value="borrador">borrador</option>
                          <option value="activo">activo</option>
                          <option value="vencido">vencido</option>
                        </Select>
                      </AdminForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
            Todavía no hay contratos. Crea primero un patrocinador y después su contrato.
          </p>
        )}
      </Section>

      <Section title={`Espacios asignados (${placements.length})`}>
        <p className="mb-3 text-sm text-muted">
          Gana el ámbito más específico: una categoría le quita el espacio a su liga. Dos exclusivos no pueden
          cruzar fechas en el mismo espacio y ámbito; la base lo impide.
        </p>
        <ul className="grid gap-3 md:grid-cols-2">
          {placements.map((p) => (
            <li key={p.id} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{p.slotName}</span>
                <span className="block text-sm text-muted">
                  {scopeLabel.get(`${p.scope}:${p.scope_id}`) ?? p.scope}
                </span>
                <span className="block text-xs text-muted">
                  {formatDateOnly(p.starts_on)} – {formatDateOnly(p.ends_on)} · peso {p.rotation_weight}
                  {p.exclusive ? " · exclusivo" : ""}
                </span>
              </span>
              <AdminForm action={deletePlacement} submitLabel="Retirar" danger compact confirm="¿Retirar esta asignación? El logo deja de verse.">
                <input type="hidden" name="id" value={p.id} />
              </AdminForm>
            </li>
          ))}
          {placements.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted md:col-span-2">
              Ningún espacio asignado todavía: no se ve ningún logo en la web.
            </li>
          ) : null}
        </ul>
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Asignar un espacio">
          <div className="rounded-2xl border border-border bg-surface p-4">
            {activos.length && slots.length ? (
              <AdminForm action={createPlacement} submitLabel="Asignar espacio" resetOnSuccess>
                <Field name="contract_id" label="Contrato">
                  <Select name="contract_id" required>
                    <option value="">Elige un contrato</option>
                    {activos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.sponsorName} · {c.tierName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field name="slot_id" label="Espacio">
                  <Select name="slot_id" required>
                    {slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field name="scope" label="Ámbito" hint="Dónde se ve: toda la organización, una liga, un torneo…">
                  <ScopeSelect options={scopes} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field name="starts_on" label="Desde">
                    <TextInput name="starts_on" type="date" required />
                  </Field>
                  <Field name="ends_on" label="Hasta">
                    <TextInput name="ends_on" type="date" required />
                  </Field>
                </div>
                <Field name="link_url" label="Enlace al hacer clic">
                  <TextInput name="link_url" type="url" placeholder="https://" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field name="text" label="Texto" hint='Por defecto, "Presentado por"'>
                    <TextInput name="text" maxLength={60} />
                  </Field>
                  <Field name="rotation_weight" label="Peso de rotación" hint="Entre 1 y 100, si comparten espacio">
                    <TextInput name="rotation_weight" type="number" min={1} max={100} defaultValue={1} />
                  </Field>
                </div>
              </AdminForm>
            ) : (
              <p className="text-sm text-muted">
                Hace falta un contrato <strong>activo</strong> para poder asignar espacios.
              </p>
            )}
          </div>
        </Section>

        <div className="space-y-8">
          <Section title="Nuevo contrato">
            <div className="rounded-2xl border border-border bg-surface p-4">
              {sponsors.length ? (
                <AdminForm action={createContract} submitLabel="Crear contrato" resetOnSuccess>
                  <Field name="sponsor_id" label="Patrocinador">
                    <Select name="sponsor_id" required>
                      {sponsors.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field name="tier_id" label="Nivel">
                    <Select name="tier_id" required>
                      {tiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field name="starts_on" label="Desde">
                      <TextInput name="starts_on" type="date" required />
                    </Field>
                    <Field name="ends_on" label="Hasta">
                      <TextInput name="ends_on" type="date" required />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field name="amount" label="Monto (US$)">
                      <TextInput name="amount" type="number" min={0} step="0.01" />
                    </Field>
                    <Field name="status" label="Estado">
                      <Select name="status" defaultValue="borrador">
                        <option value="borrador">Borrador</option>
                        <option value="activo">Activo</option>
                      </Select>
                    </Field>
                  </div>
                  <p className="text-xs text-muted">
                    Solo los contratos <strong>activos</strong> pintan logos en la web.
                  </p>
                </AdminForm>
              ) : (
                <p className="text-sm text-muted">Crea primero un patrocinador.</p>
              )}
            </div>
          </Section>

          <Section title="Nuevo patrocinador">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <AdminForm action={createSponsor} submitLabel="Crear patrocinador" resetOnSuccess>
                <Field name="name" label="Marca">
                  <TextInput name="name" required placeholder="Nombre comercial" />
                </Field>
                <Field name="logo" label="Logo" hint="PNG o JPG; se guarda en WebP y sin metadatos">
                  <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="text-sm" />
                </Field>
                <Field name="website" label="Sitio web">
                  <TextInput name="website" type="url" placeholder="https://" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field name="contact_name" label="Contacto">
                    <TextInput name="contact_name" />
                  </Field>
                  <Field name="contact_email" label="Correo del contacto">
                    <TextInput name="contact_email" type="email" />
                  </Field>
                </div>
              </AdminForm>
            </div>
          </Section>
        </div>
      </div>

      <Section title={`Marcas (${sponsors.length})`}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sponsors.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
              {s.logoUrl ? (
                <img src={s.logoUrl} alt="" className="max-h-10 w-16 object-contain" />
              ) : (
                <span className="grid h-10 w-16 shrink-0 place-items-center rounded-lg border-2 border-dashed border-border text-[10px] text-muted">
                  sin logo
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block truncate text-xs text-muted">{s.contact_email ?? s.website ?? "—"}</span>
              </span>
              {s.active ? null : <span className="text-[11px] font-bold text-brand-red uppercase">En pausa</span>}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/** Los ámbitos agrupados por tipo: organización, ligas, circuitos, torneos, categorías. */
function ScopeSelect({ options }: { options: ScopeOption[] }) {
  const groups = new Map<string, ScopeOption[]>();
  for (const option of options) groups.set(option.group, [...(groups.get(option.group) ?? []), option]);

  return (
    <Select name="scope" required defaultValue="">
      <option value="">Elige un ámbito</option>
      {[...groups.entries()].map(([group, items]) => (
        <optgroup key={group} label={group}>
          {items.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
