"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, ShieldAlert, X } from "lucide-react";
import { registerUpload } from "@/app/partidos/[id]/actions";
import { createClient } from "@/lib/supabase/client";

/**
 * Subir una foto a la galería del partido.
 *
 * El archivo original va primero al depósito de cuarentena, directamente desde
 * el navegador: así una foto de celular de varios MB no choca con el límite de
 * las acciones de servidor. Después el servidor le quita los metadatos de
 * ubicación, la comprime y la deja pendiente de revisión.
 */

type Player = { playerId: string; name: string; jerseyNumber: number; teamName?: string };

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function UploadPhoto({ matchId, userId, players }: { matchId: string; userId: string; players: Player[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tagged, setTagged] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function pick(selected: File | null) {
    setMessage(null);
    if (!selected) return reset();
    if (selected.type.startsWith("video/")) {
      setMessage({ text: "Por ahora solo se pueden subir fotos, no videos.", error: true });
      return;
    }
    if (!ACCEPTED.includes(selected.type)) {
      setMessage({ text: "El archivo debe ser una foto (JPG, PNG, WebP o HEIC).", error: true });
      return;
    }
    if (selected.size > MAX_BYTES) {
      setMessage({ text: "La foto es demasiado grande (máximo 25 MB).", error: true });
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setTagged(new Set());
    setCaption("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function toggleTag(playerId: string) {
    setTagged((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function send() {
    if (!file) return;
    startTransition(async () => {
      setMessage(null);
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;

      const supabase = createClient();
      const { error } = await supabase.storage
        .from("media-uploads")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        setMessage({ text: `No se pudo subir la foto: ${error.message}`, error: true });
        return;
      }

      const result = await registerUpload({
        matchId,
        uploadPath: path,
        caption: caption.trim() || undefined,
        playerIds: [...tagged],
      });
      if (result.ok) {
        reset();
        setMessage({ text: result.message });
        router.refresh();
      } else {
        setMessage({ text: result.error, error: true });
      }
    });
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-5">
      <h2 className="text-sm font-bold tracking-wide text-muted uppercase">Subir una foto</h2>

      {!file ? (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 font-bold text-white"
          >
            <Camera className="size-5" aria-hidden />
            Elegir una foto
          </button>
          <p className="mt-3 text-xs text-muted">
            La revisará un administrador antes de que se vea. Se le quitan los datos de ubicación
            automáticamente.
          </p>
        </>
      ) : (
        <div className="mt-4 space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local, aún no subida */}
          <img src={preview ?? ""} alt="Vista previa" className="max-h-64 w-full rounded-2xl object-contain" />

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Pie de foto (opcional)</span>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
              placeholder="El gol del empate"
              className="min-h-12 w-full rounded-xl border border-border bg-background px-3"
            />
          </label>

          <fieldset>
            <legend className="mb-1 text-sm font-medium">¿Quiénes salen en la foto?</legend>
            <p className="mb-2 text-xs text-muted">
              Si alguno no tiene permiso de foto de su familia, un administrador tendrá que recortarlo
              antes de poder publicarla.
            </p>
            <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
              {players.map((p) => {
                const on = tagged.has(p.playerId);
                return (
                  <button
                    key={p.playerId}
                    type="button"
                    onClick={() => toggleTag(p.playerId)}
                    aria-pressed={on}
                    className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm ${
                      on ? "border-brand-blue bg-brand-blue font-semibold text-white" : "border-border bg-background"
                    }`}
                  >
                    {on ? <Check className="size-4" aria-hidden /> : null}
                    {p.jerseyNumber} · {p.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={send}
              disabled={pending}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 font-bold text-white disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              Enviar para revisión
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="flex min-h-12 items-center justify-center rounded-xl border border-border px-4 font-medium disabled:opacity-60"
            >
              <X className="size-5" aria-hidden />
              <span className="sr-only">Quitar la foto</span>
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />

      {message ? (
        <p
          role="status"
          className={`mt-3 flex items-start gap-2 text-sm font-medium ${message.error ? "text-brand-red" : "text-brand-blue"}`}
        >
          {message.error ? <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
