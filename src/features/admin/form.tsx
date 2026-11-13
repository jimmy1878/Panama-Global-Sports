"use client";

import { createContext, startTransition, use, useActionState, useEffect, useRef } from "react";
import type { ActionState } from "./action";

const FormStateContext = createContext<ActionState>({});

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Formulario del panel: muestra errores por campo y mensajes, y no borra lo
 * escrito si hay un error. Las fotos se reducen en el navegador antes de enviarse.
 */
export function AdminForm({
  action,
  children,
  submitLabel = "Guardar",
  resetOnSuccess = false,
  confirm,
  danger = false,
  className = "space-y-4",
  compact = false,
}: {
  action: Action;
  children?: React.ReactNode;
  submitLabel?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  danger?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirm && !window.confirm(confirm)) return;
    const formData = new FormData(event.currentTarget);
    for (const [name, value] of [...formData.entries()]) {
      if (value instanceof File && value.size > 0 && value.type.startsWith("image/") && value.type !== "image/svg+xml") {
        formData.set(name, await shrinkImage(value));
      }
    }
    startTransition(() => formAction(formData));
  }

  const button = (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition-opacity disabled:opacity-60 ${
        danger ? "border border-brand-red text-brand-red" : "bg-brand-blue text-white"
      } ${compact ? "" : "w-full sm:w-auto"}`}
    >
      {pending ? "Guardando…" : submitLabel}
    </button>
  );

  return (
    <FormStateContext value={state}>
      <form ref={ref} onSubmit={onSubmit} className={className} noValidate={false}>
        {children}
        {compact ? (
          button
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            {button}
            <FormMessage state={state} />
          </div>
        )}
      </form>
      {compact && (state.error || state.message) ? <FormMessage state={state} /> : null}
    </FormStateContext>
  );
}

function FormMessage({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="text-sm text-brand-red">{state.error}</p>;
  if (state.ok && state.message) return <p className="text-sm text-muted">{state.message}</p>;
  return null;
}

const inputClass =
  "block h-11 w-full rounded-xl border border-border bg-surface px-3 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 md:text-sm";

export function Field({
  name,
  label,
  hint,
  children,
  className = "",
}: {
  name: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const errors = use(FormStateContext).fieldErrors?.[name];
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      <span className="mt-1 block">{children}</span>
      {errors?.length ? (
        <span className="mt-1 block text-xs text-brand-red">{errors[0]}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputClass} ${props.className ?? ""}`}>
      {children}
    </select>
  );
}

export function Checkbox({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input type="checkbox" {...props} className="size-5 accent-brand-blue" />
      {label}
    </label>
  );
}

/** Reduce una foto a 1600 px como máximo (JPEG). Si el navegador no puede, envía la original. */
async function shrinkImage(file: File, max = 1600): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const keepAlpha = file.type === "image/png" || file.type === "image/webp";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, keepAlpha ? "image/png" : "image/jpeg", 0.85),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, keepAlpha ? ".png" : ".jpg"), { type: blob.type });
  } catch {
    return file;
  }
}
