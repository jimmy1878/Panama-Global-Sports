import Link from "next/link";
import { UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

/** Lee la sesión: va dentro de <Suspense fallback={<AccountButtonFallback />}>. */
export async function AccountButton() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link
        href="/ingresar"
        className="flex h-10 items-center rounded-full bg-brand-blue px-4 text-sm font-semibold text-white"
      >
        Ingresar
      </Link>
    );
  }

  const initial = (user.fullName ?? user.email ?? "?").trim().charAt(0).toUpperCase();
  return (
    <Link
      href="/mas"
      aria-label="Mi cuenta"
      className="grid size-10 place-items-center rounded-full bg-brand-blue/10 text-sm font-bold text-brand-blue"
    >
      {initial}
    </Link>
  );
}

export function AccountButtonFallback() {
  return (
    <span aria-hidden className="grid size-10 place-items-center rounded-full bg-surface-muted text-muted">
      <UserRound className="size-5" />
    </span>
  );
}
