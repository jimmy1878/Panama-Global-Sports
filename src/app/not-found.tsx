import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-sm py-12 text-center">
      <SearchX className="mx-auto size-12 text-muted" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold">No encontramos esta página</h1>
      <p className="mt-2 text-muted">Puede que el enlace esté mal escrito o que ya no exista.</p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-brand-blue px-6 font-semibold text-white"
      >
        Ir al inicio
      </Link>
    </section>
  );
}
