import Link from "next/link";
import { LogIn, LogOut, Radio, Settings } from "lucide-react";
import { getCurrentUser, ROLE_LABELS } from "@/lib/auth";
import { signOutAction } from "../ingresar/actions";

/** Lee la sesión: va dentro de <Suspense>. */
export async function AccountCard() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Tu cuenta</h2>
        <p className="mt-1 text-sm text-muted">
          Ingresa para seguir a tus equipos, recibir avisos y votar al jugador del partido.
        </p>
        <Link
          href="/ingresar?next=/mas"
          className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-blue font-semibold text-white"
        >
          <LogIn className="size-5" aria-hidden />
          Ingresar
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Tu cuenta</h2>
      <dl className="mt-3 space-y-2 text-sm">
        {user.fullName ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Nombre</dt>
            <dd className="font-medium">{user.fullName}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Correo</dt>
          <dd className="truncate font-medium">{user.email}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Rol</dt>
          <dd className="font-medium">{ROLE_LABELS[user.role]}</dd>
        </div>
      </dl>
      {user.role === "admin" || user.role === "delegate" ? (
        <Link
          href="/delegado"
          className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-brand-blue font-semibold text-brand-blue"
        >
          <Radio className="size-5" aria-hidden />
          Marcador en vivo (delegado)
        </Link>
      ) : null}
      {user.role === "admin" ? (
        <Link
          href="/admin"
          className="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-blue font-semibold text-white"
        >
          <Settings className="size-5" aria-hidden />
          Panel de administración
        </Link>
      ) : null}
      <form action={signOutAction} className="mt-3">
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border font-semibold text-foreground"
        >
          <LogOut className="size-5" aria-hidden />
          Cerrar sesión
        </button>
      </form>
    </section>
  );
}

export function AccountCardFallback() {
  return <section aria-hidden className="h-44 animate-pulse rounded-2xl border border-border bg-surface" />;
}
