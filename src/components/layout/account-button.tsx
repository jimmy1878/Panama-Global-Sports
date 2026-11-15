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
        className="flex h-10 items-center rounded-full bg-gold px-4 text-sm font-bold text-navy"
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
      className="grid size-10 place-items-center rounded-full border border-gold/40 bg-white/10 text-sm font-bold text-gold"
    >
      {initial}
    </Link>
  );
}

export function AccountButtonFallback() {
  return (
    <span aria-hidden className="grid size-10 place-items-center rounded-full bg-white/10 text-white/70">
      <UserRound className="size-5" />
    </span>
  );
}
