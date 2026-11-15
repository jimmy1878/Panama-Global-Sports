import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PageTitle, Section } from "@/components/ui/section";
import { getChronicles } from "@/features/admin/data";
import { AdminForm, Field, Textarea } from "@/features/admin/form";
import { countWords, MAX_WORDS, MIN_WORDS } from "@/features/chronicles/rules";
import { formatDay } from "@/lib/format";
import {
  discardChronicle,
  publishChronicle,
  requestChronicle,
  saveChronicle,
  unpublishChronicle,
} from "./actions";

export const metadata: Metadata = { title: "Crónicas" };

export default async function ChroniclesAdminPage() {
  const matches = await getChronicles();
  const drafts = matches.filter((m) => m.chronicle?.status === "draft");
  const published = matches.filter((m) => m.chronicle?.status === "published");
  const missing = matches.filter((m) => !m.chronicle);

  return (
    <div className="space-y-8">
      <PageTitle
        title="Crónicas"
        subtitle="El relato de cada partido lo escribe la IA y lo publicas tú. Nada se publica solo."
      />

      <Section title={`Borradores por revisar (${drafts.length})`}>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted">No hay borradores pendientes.</p>
        ) : (
          <ul className="space-y-4">
            {drafts.map((m) => (
              <ChronicleCard key={m.id} match={m} />
            ))}
          </ul>
        )}
      </Section>

      {missing.length > 0 ? (
        <Section title={`Partidos sin crónica (${missing.length})`}>
          <p className="mb-3 text-sm text-muted">
            Partidos terminados para los que no se generó un borrador. Pedir uno cuesta una llamada a la
            API.
          </p>
          <ul className="space-y-2">
            {missing.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4"
              >
                <span className="text-sm">
                  <strong>
                    {m.home?.name} {m.home_score}–{m.away_score} {m.away?.name}
                  </strong>
                  <span className="ml-2 text-muted">
                    {m.category?.league?.name} {m.category?.code} · {formatDay(m.starts_at)}
                  </span>
                </span>
                <AdminForm action={requestChronicle} submitLabel="Pedir crónica" compact className="contents">
                  <input type="hidden" name="match_id" value={m.id} />
                </AdminForm>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {published.length > 0 ? (
        <Section title={`Publicadas (${published.length})`}>
          <ul className="space-y-4">
            {published.map((m) => (
              <ChronicleCard key={m.id} match={m} />
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

type MatchRow = Awaited<ReturnType<typeof getChronicles>>[number];

function ChronicleCard({ match }: { match: MatchRow }) {
  const chronicle = match.chronicle!;
  const isDraft = chronicle.status === "draft";
  const words = countWords(chronicle.body);
  const edited = chronicle.generated_body != null && chronicle.generated_body !== chronicle.body;

  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">
          {match.home?.name} {match.home_score}–{match.away_score} {match.away?.name}
        </h3>
        <span className="text-xs text-muted">
          {match.category?.league?.name} {match.category?.code} · {formatDay(match.starts_at)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            isDraft ? "bg-surface-muted text-muted" : "bg-brand-blue text-white"
          }`}
        >
          {isDraft ? "Borrador" : "Publicada"}
        </span>
        <Link href={`/partidos/${match.id}`} className="text-xs font-medium text-brand-blue">
          Ver el partido
        </Link>
      </div>

      <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Sparkles className="size-3.5" aria-hidden />
        Escrita por {chronicle.model ?? "la IA"}
        {chronicle.generated_at ? ` el ${formatDay(chronicle.generated_at)}` : ""}
        {edited ? " · editada a mano" : ""}
        <span className={words < MIN_WORDS || words > MAX_WORDS ? "font-semibold text-brand-red" : ""}>
          · {words} palabras ({MIN_WORDS}–{MAX_WORDS})
        </span>
      </p>

      <AdminForm
        action={isDraft ? publishChronicle : saveChronicle}
        submitLabel={isDraft ? "Publicar" : "Guardar cambios"}
      >
        <input type="hidden" name="match_id" value={match.id} />
        <Field name="body" label="Texto de la crónica">
          <Textarea name="body" defaultValue={chronicle.body} required />
        </Field>
      </AdminForm>

      <div className="mt-2 flex flex-wrap gap-2">
        {isDraft ? (
          <>
            <AdminForm action={saveChronicle} submitLabel="Guardar sin publicar" compact className="contents">
              <input type="hidden" name="match_id" value={match.id} />
              <input type="hidden" name="body" value={chronicle.body} />
            </AdminForm>
            <AdminForm
              action={discardChronicle}
              submitLabel="Descartar"
              confirm="¿Descartar este borrador? Podrás pedir uno nuevo."
              danger
              compact
              className="contents"
            >
              <input type="hidden" name="match_id" value={match.id} />
            </AdminForm>
          </>
        ) : (
          <AdminForm
            action={unpublishChronicle}
            submitLabel="Retirar de la web"
            confirm="¿Retirar la crónica? Dejará de verse en la página del partido."
            danger
            compact
            className="contents"
          >
            <input type="hidden" name="match_id" value={match.id} />
          </AdminForm>
        )}
      </div>
    </li>
  );
}
