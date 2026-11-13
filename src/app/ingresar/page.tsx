import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { getSupabaseEnv, SUPABASE_NOT_CONFIGURED } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default function IngresarPage() {
  const configured = getSupabaseEnv() !== null;

  return (
    <div className="mx-auto max-w-md md:grid md:max-w-4xl md:grid-cols-2 md:items-center md:gap-12">
      {/* Desktop: panel de bienvenida a la izquierda */}
      <section className="hidden md:block">
        <h1 className="text-4xl font-bold leading-tight">
          Toda la liga <span className="text-brand-blue">en tu bolsillo</span>
        </h1>
        <p className="mt-4 text-lg text-muted">
          Sigue los partidos de tus hijos en vivo, recibe avisos y vota al jugador del partido.
        </p>
        <p className="mt-6 flex items-start gap-2 text-sm text-muted">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden />
          Cuidamos la privacidad de los niños: solo mostramos nombre e inicial del apellido.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-bold md:hidden">Ingresar</h1>
        <h2 className="hidden text-2xl font-bold md:block">Ingresar</h2>
        <p className="mt-1 mb-6 text-sm text-muted">
          Sin contraseña: te enviamos un código a tu correo. Si es tu primera vez, se crea tu cuenta.
        </p>

        {configured ? (
          <Suspense>
            <LoginForm />
          </Suspense>
        ) : (
          <p className="rounded-xl bg-brand-red/10 p-4 text-sm text-brand-red">{SUPABASE_NOT_CONFIGURED}</p>
        )}
      </section>
    </div>
  );
}
