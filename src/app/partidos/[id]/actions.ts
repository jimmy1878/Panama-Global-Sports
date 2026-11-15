"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { processMedia } from "@/features/gallery/process";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Subida de fotos a la galería de un partido.
 *
 * El navegador sube el ORIGINAL a `media-uploads/{user_id}/…`, un depósito de
 * cuarentena que nadie lee desde la app (así una foto de 8 MB del celular no
 * choca con el límite de las acciones de servidor). Después llama aquí:
 *
 *   1. se crea la fila en estado `processing` con la sesión del usuario, de
 *      modo que RLS compruebe que puede subir a ese partido;
 *   2. se etiquetan los jugadores que aparecen;
 *   3. el SERVIDOR quita EXIF/GPS, comprime y pasa la fila a `pending_review`.
 *
 * Nada se ve hasta que un admin lo aprueba, y la base impide aprobar si
 * aparece un niño sin consentimiento sin recortar.
 */

export type UploadResult = { ok: true; message: string } | { ok: false; error: string };

const schema = z.object({
  matchId: z.uuid("Partido no válido"),
  uploadPath: z.string().min(1).max(300),
  caption: z.string().trim().max(200).optional(),
  playerIds: z.array(z.uuid()).max(30),
});

export async function registerUpload(input: {
  matchId: string;
  uploadPath: string;
  caption?: string;
  playerIds: string[];
}): Promise<UploadResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos de la subida no válidos." };
  const { matchId, uploadPath, caption, playerIds } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Ingresa con tu cuenta para subir fotos." };

  // La ruta tiene que estar dentro de la carpeta de quien sube
  if (!uploadPath.startsWith(`${user.id}/`)) return { ok: false, error: "Ruta de subida no válida." };

  const supabase = await createClient();

  // RLS comprueba aquí si esta persona puede subir a este partido
  const { data: created, error } = await supabase
    .from("media_items")
    .insert({
      match_id: matchId,
      uploaded_by: user.id,
      kind: "photo",
      status: "processing",
      upload_path: uploadPath,
      metadata_stripped: false,
      caption: caption || null,
    })
    .select("id")
    .single();

  if (error || !created) {
    await supabase.storage.from("media-uploads").remove([uploadPath]);
    const denied = error?.code === "42501" || error?.message?.includes("row-level security");
    return {
      ok: false,
      error: denied
        ? "Solo pueden subir fotos los delegados del partido y las familias con un hijo jugando."
        : (error?.message ?? "No se pudo registrar la foto."),
    };
  }

  if (playerIds.length) {
    const { error: tagError } = await supabase
      .from("media_tags")
      .insert(playerIds.map((playerId) => ({ media_id: created.id, player_id: playerId })));
    // Una etiqueta inválida no debe tumbar la subida: la foto sigue, sin esa etiqueta
    if (tagError) console.warn("Etiquetas de la foto", tagError.message);
  }

  const processed = await processMedia(created.id);
  if (!processed.ok) return { ok: false, error: processed.reason };

  updateTag("matches");
  updateTag(`match-${matchId}`);
  return {
    ok: true,
    message: "Foto enviada. Un administrador la revisará antes de que se vea.",
  };
}
