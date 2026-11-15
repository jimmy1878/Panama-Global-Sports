import { ImageOff, Lock } from "lucide-react";
import { Section } from "@/components/ui/section";
import { getCurrentUser } from "@/lib/auth";
import { canUploadTo, getMatchGallery, getTaggablePlayers } from "./data";
import { UploadPhoto } from "./upload-photo";

/**
 * Galería del partido. Es una pieza con sesión dentro de una página pública,
 * así que va siempre dentro de <Suspense>.
 *
 * Quién ve qué lo decide la base: una familia de la liga ve lo aprobado, quien
 * subió algo ve lo suyo aunque esté pendiente, y el público sin cuenta no ve
 * nada. Aquí solo se dibuja lo que la consulta devuelve.
 */
export async function MatchGallerySection({ matchId }: { matchId: string }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Section title="Galería">
        <p className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
          <Lock className="size-4 shrink-0" aria-hidden />
          Las fotos del partido son solo para las familias de la liga. Ingresa con tu cuenta para verlas.
        </p>
      </Section>
    );
  }

  const [items, canUpload] = await Promise.all([getMatchGallery(matchId), canUploadTo(matchId)]);
  const players = canUpload ? await getTaggablePlayers(matchId) : [];

  return (
    <Section title="Galería">
      <div className="space-y-4">
        {items.length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
            <ImageOff className="size-4 shrink-0" aria-hidden />
            Todavía no hay fotos aprobadas de este partido.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <a href={item.url ?? "#"} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada que caduca; next/image no la puede optimizar */}
                  <img
                    src={item.thumbUrl ?? item.url ?? ""}
                    alt={item.caption ?? "Foto del partido"}
                    loading="lazy"
                    className="aspect-square w-full rounded-xl border border-border bg-surface-muted object-cover"
                  />
                </a>
                {item.caption ? <p className="mt-1 text-xs text-muted">{item.caption}</p> : null}
              </li>
            ))}
          </ul>
        )}

        {canUpload ? <UploadPhoto matchId={matchId} userId={user.id} players={players} /> : null}
      </div>
    </Section>
  );
}
