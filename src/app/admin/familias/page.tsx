import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmptyState, PageTitle, Section } from "@/components/ui/section";
import { getFamilies } from "@/features/admin/data";
import { AdminForm, Field, TextInput } from "@/features/admin/form";
import { createFamily } from "./actions";

export const metadata: Metadata = { title: "Familias" };

export default async function FamiliesAdminPage() {
  const families = await getFamilies();

  return (
    <div className="space-y-8">
      <PageTitle
        title="Familias"
        subtitle="Une a los adultos con sus hijos. Así pueden dar consentimiento de foto, seguir sus partidos y votar."
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <Section title={`Familias (${families.length})`}>
          {families.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {families.map((f) => (
                <li key={f.id}>
                  <Link href={`/admin/familias/${f.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{f.name}</span>
                      <span className="block text-xs text-muted">
                        {f.family_members.length} adultos · {f.family_players.length} hijos
                        {f.family_members.length === 0 || f.family_players.length === 0 ? " · incompleta" : ""}
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Todavía no hay familias. Crea la primera.</EmptyState>
          )}
        </Section>

        <Section title="Nueva familia">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <AdminForm action={createFamily} submitLabel="Crear y continuar">
              <Field name="name" label="Nombre" hint="Solo lo ven la familia y los administradores.">
                <TextInput name="name" required placeholder="Familia Rodríguez" />
              </Field>
            </AdminForm>
          </div>
        </Section>
      </div>
    </div>
  );
}
