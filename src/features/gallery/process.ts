import "server-only";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/admin";

/**
 * Convierte el original de la cuarentena en la versión que verán las familias.
 *
 * El original llega al bucket `media-uploads/{user_id}/…`, que nadie lee desde
 * la app. Aquí el SERVIDOR lo descarga, le quita los metadatos EXIF/GPS —que
 * llevan la ubicación exacta donde se tomó la foto de un niño—, lo comprime y
 * lo escribe en `match-media`. Solo entonces la fila pasa a `pending_review`
 * y un admin puede aprobarla.
 *
 * Nada de esto puede ocurrir en el navegador: si el recorte de metadatos
 * dependiera del cliente, bastaría con saltárselo.
 */

/** Lado mayor de la foto publicada y de su miniatura. */
const FULL_SIZE = 1600;
const THUMB_SIZE = 480;

export type ProcessResult = { ok: true } | { ok: false; reason: string };

export async function processMedia(mediaId: string): Promise<ProcessResult> {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false, reason: "Falta la clave de servicio de Supabase." };

  const { data: item, error } = await supabase
    .from("media_items")
    .select("id, kind, status, upload_path")
    .eq("id", mediaId)
    .maybeSingle();
  if (error || !item) return { ok: false, reason: "No se encontró el archivo." };
  if (item.status !== "processing") return { ok: false, reason: "Ese archivo ya fue procesado." };
  if (!item.upload_path) return { ok: false, reason: "No hay original que procesar." };

  // El video necesita otra herramienta (ffmpeg): decisión pendiente de la liga.
  if (item.kind !== "photo") {
    await fail(supabase, mediaId, "Todavía no se procesan videos.");
    return { ok: false, reason: "Todavía no se procesan videos." };
  }

  const original = await supabase.storage.from("media-uploads").download(item.upload_path);
  if (original.error || !original.data) {
    await fail(supabase, mediaId, "No se pudo leer el original.");
    return { ok: false, reason: "No se pudo leer el original." };
  }

  try {
    const input = Buffer.from(await original.data.arrayBuffer());
    // `rotate()` aplica la orientación EXIF y luego sharp descarta los metadatos:
    // la foto queda derecha y sin GPS. `failOn: "error"` rechaza archivos corruptos.
    const base = sharp(input, { failOn: "error" }).rotate();
    const [full, thumb, meta] = await Promise.all([
      base.clone().resize(FULL_SIZE, FULL_SIZE, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true }),
      base.clone().resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true }).webp({ quality: 70 }).toBuffer(),
      base.metadata(),
    ]);

    const folder = mediaId.slice(0, 2);
    const storagePath = `${folder}/${mediaId}.webp`;
    const thumbPath = `${folder}/${mediaId}-thumb.webp`;

    const uploads = await Promise.all([
      supabase.storage.from("match-media").upload(storagePath, full.data, { contentType: "image/webp", upsert: true }),
      supabase.storage.from("match-media").upload(thumbPath, thumb, { contentType: "image/webp", upsert: true }),
    ]);
    for (const u of uploads) {
      if (u.error) {
        await fail(supabase, mediaId, "No se pudo guardar la foto procesada.");
        return { ok: false, reason: u.error.message };
      }
    }

    const { error: updateError } = await supabase
      .from("media_items")
      .update({
        status: "pending_review",
        storage_path: storagePath,
        thumbnail_path: thumbPath,
        mime_type: "image/webp",
        width: full.info.width,
        height: full.info.height,
        size_bytes: full.info.size,
        metadata_stripped: true,
      })
      .eq("id", mediaId);
    if (updateError) {
      await fail(supabase, mediaId, updateError.message);
      return { ok: false, reason: updateError.message };
    }

    // El original con EXIF ya no hace falta: fuera de la cuarentena.
    await supabase.storage.from("media-uploads").remove([item.upload_path]);
    void meta;
    return { ok: true };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "No se pudo procesar la imagen.";
    await fail(supabase, mediaId, reason);
    return { ok: false, reason };
  }
}

/** Marca el archivo como rechazado para que no quede colgado en 'processing'. */
async function fail(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  mediaId: string,
  reason: string,
) {
  await supabase
    .from("media_items")
    .update({ status: "rejected", rejection_reason: reason.slice(0, 200) })
    .eq("id", mediaId);
}
