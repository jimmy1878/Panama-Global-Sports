import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Panama Global Sports, inicio">
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-xl bg-brand-blue text-xs font-black text-white"
      >
        PGS
      </span>
      <span aria-hidden className="leading-tight">
        <span className="block text-sm font-bold">Panama Global Sports</span>
        <span className="block text-[11px] font-medium text-brand-red">Ligas infantiles</span>
      </span>
    </Link>
  );
}
