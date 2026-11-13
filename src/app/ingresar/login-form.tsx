"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { step: "email", email: "" };

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/mas";
  const linkFailed = searchParams.get("error") === "enlace";
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {state.step === "email" ? (
        <>
          <label className="block">
            <span className="text-sm font-medium">Correo electrónico</span>
            <input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              defaultValue={state.email}
              placeholder="tucorreo@ejemplo.com"
              className="mt-1 block h-12 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            />
          </label>
          <SubmitButton intent="send" pending={pending}>
            Enviarme un código
          </SubmitButton>
        </>
      ) : (
        <>
          <input type="hidden" name="email" value={state.email} />
          <label className="block">
            <span className="text-sm font-medium">Código de 6 dígitos</span>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={9}
              required
              autoFocus
              placeholder="123456"
              className="mt-1 block h-14 w-full rounded-xl border border-border bg-surface px-4 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            />
          </label>
          <SubmitButton intent="verify" pending={pending}>
            Entrar
          </SubmitButton>
          <div className="flex justify-between text-sm">
            <button type="submit" name="intent" value="send" formNoValidate className="font-medium text-brand-blue">
              Reenviar código
            </button>
            <button type="submit" name="intent" value="change-email" formNoValidate className="text-muted">
              Usar otro correo
            </button>
          </div>
        </>
      )}

      <div aria-live="polite" className="min-h-5 text-sm">
        {state.error ? (
          <p className="text-brand-red">{state.error}</p>
        ) : state.message ? (
          <p className="text-muted">{state.message}</p>
        ) : linkFailed ? (
          <p className="text-brand-red">
            El enlace no funcionó o ya venció. Pide un correo nuevo y ábrelo en este mismo navegador.
          </p>
        ) : null}
      </div>
    </form>
  );
}

function SubmitButton({
  intent,
  pending,
  children,
}: {
  intent: string;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      disabled={pending}
      className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-blue text-base font-semibold text-white transition-opacity disabled:opacity-60"
    >
      {pending ? "Un momento…" : children}
    </button>
  );
}
