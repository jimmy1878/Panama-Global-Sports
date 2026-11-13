import type { Metadata } from "next";
import { PageTitle, Section } from "@/components/ui/section";
import { getVenues } from "@/features/admin/data";
import { AdminForm, Checkbox, Field, TextInput } from "@/features/admin/form";
import { createVenue, updateVenue } from "./actions";

export const metadata: Metadata = { title: "Canchas" };

export default async function VenuesAdminPage() {
  const venues = await getVenues();

  return (
    <div className="space-y-8">
      <PageTitle title="Canchas" subtitle="Se muestran en el calendario y en los recordatorios de partidos." />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <Section title={`Canchas (${venues.length})`}>
          <ul className="space-y-3">
            {venues.map((v) => (
              <li key={v.id} className="rounded-2xl border border-border bg-surface p-4">
                <AdminForm action={updateVenue}>
                  <input type="hidden" name="id" value={v.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field name="name" label="Nombre">
                      <TextInput name="name" defaultValue={v.name} required />
                    </Field>
                    <Field name="address" label="Dirección">
                      <TextInput name="address" defaultValue={v.address ?? ""} />
                    </Field>
                  </div>
                  <Field name="maps_url" label="Enlace de Google Maps">
                    <TextInput name="maps_url" type="url" defaultValue={v.maps_url ?? ""} placeholder="https://maps.app.goo.gl/…" />
                  </Field>
                  <Checkbox name="is_active" defaultChecked={v.is_active} label="Activa (se puede elegir en partidos nuevos)" />
                </AdminForm>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Nueva cancha">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <AdminForm action={createVenue} submitLabel="Crear cancha" resetOnSuccess>
              <Field name="name" label="Nombre">
                <TextInput name="name" required placeholder="Cancha 2" />
              </Field>
              <Field name="address" label="Dirección">
                <TextInput name="address" />
              </Field>
              <Field name="maps_url" label="Enlace de Google Maps">
                <TextInput name="maps_url" type="url" />
              </Field>
            </AdminForm>
          </div>
        </Section>
      </div>
    </div>
  );
}
