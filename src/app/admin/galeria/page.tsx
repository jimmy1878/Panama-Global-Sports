import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { PageTitle, Section } from "@/components/ui/section";
import { AdminForm, Field, TextInput } from "@/features/admin/form";
import { getReviewQueue } from "@/features/gallery/data";
import { formatDay } from "@/lib/format";
import { approveMedia, deleteMedia, rejectMedia, setTagRedacted } from "./actions";

export const metadata: Metadata = { title: "Galería" };

export default async function GalleryAdminPage() {
  const queue = await getReviewQueue();
  const blocked = queue.filter((item) => item.blockingTags > 0);
  const ready = queue.filter((item) => item.blockingTags === 0);

  return (
    <div className="space-y-8">
      <PageTitle
        title="Galería"
        subtitle="Nada se ve hasta que lo apruebas. Si en la foto sale un niño sin permiso, la base no te deja publicarla."
      />

      {blocked.length > 0 ? (
        <Section title={`Bloqueadas por consentimiento (${blocked.length})`}>
          <p className="mb-3 text-sm text-muted">
            En estas fotos aparece algún niño cuya familia no autorizó mostrar su imagen. Recórtalo o
            difumínalo en la foto y márcalo abajo; hasta entonces no se pueden aprobar.
          </p>
          <ul className="space-y-4">
            {blocked.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={`Por revisar (${ready.length})`}>
        {ready.length === 0 ? (
          <p className="text-sm text-muted">No hay fotos pendientes.</p>
        ) : (
          <ul className="space-y-4">
            {ready.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

type Item = Awaited<ReturnType<typeof getReviewQueue>>[number];

function MediaCard({ item }: { item: Item }) {
  const blocked = item.blockingTags > 0;

  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-4 md:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada que caduca */}
        <img
          src={item.url ?? ""}
          alt="Foto pendiente de revisión"
          className="w-full rounded-xl border border-border object-contain md:max-h-56 md:w-64"
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="font-semibold">
              {item.match?.home?.name} vs {item.match?.away?.name}
            </h3>
            <p className="text-xs text-muted">
              {item.match ? formatDay(item.match.starts_at) : ""} ·{" "}
              {item.status === "approved" ? "Estaba aprobada y quedó bloqueada" : "Pendiente"} · subida{" "}
              {formatDay(item.createdAt)}
              {" · "}
              <Link href={`/partidos/${item.matchId}`} className="font-medium text-brand-blue">
                ver el partido
              </Link>
            </p>
          </div>

          {item.tags.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
                Quiénes salen
              </p>
              <ul className="space-y-1">
                {item.tags.map((tag) => {
                  const problem = !tag.consent && !tag.redacted;
                  return (
                    <li key={tag.playerId} className="flex flex-wrap items-center gap-2 text-sm">
                      {tag.consent ? (
                        <ShieldCheck className="size-4 shrink-0 text-brand-blue" aria-hidden />
                      ) : (
                        <ShieldAlert
                          className={`size-4 shrink-0 ${problem ? "text-brand-red" : "text-muted"}`}
                          aria-hidden
                        />
                      )}
                      <span className={problem ? "font-semibold text-brand-red" : ""}>{tag.name}</span>
                      <span className="text-xs text-muted">
                        {tag.consent ? "con permiso" : tag.redacted ? "sin permiso · recortado" : "SIN PERMISO"}
                      </span>
                      {!tag.consent ? (
                        <AdminForm
                          action={setTagRedacted}
                          submitLabel={tag.redacted ? "Deshacer recorte" : "Ya lo recorté"}
                          compact
                          className="contents"
                        >
                          <input type="hidden" name="media_id" value={item.id} />
                          <input type="hidden" name="player_id" value={tag.playerId} />
                          <input type="hidden" name="redacted" value={tag.redacted ? "0" : "1"} />
                        </AdminForm>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted">Sin jugadores etiquetados.</p>
          )}

          <div className="flex flex-wrap gap-2">
            {!blocked ? (
              <AdminForm action={approveMedia} submitLabel="Aprobar" compact className="contents">
                <input type="hidden" name="media_id" value={item.id} />
              </AdminForm>
            ) : null}
            <AdminForm
              action={deleteMedia}
              submitLabel="Eliminar"
              confirm="¿Eliminar la foto? No se puede deshacer."
              danger
              compact
              className="contents"
            >
              <input type="hidden" name="media_id" value={item.id} />
            </AdminForm>
          </div>

          <AdminForm action={rejectMedia} submitLabel="Rechazar" compact>
            <input type="hidden" name="media_id" value={item.id} />
            <Field name="reason" label="Motivo del rechazo (opcional)">
              <TextInput name="reason" maxLength={200} placeholder="Sale borrosa" />
            </Field>
          </AdminForm>
        </div>
      </div>
    </li>
  );
}
