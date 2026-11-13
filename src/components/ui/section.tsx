import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Section({
  title,
  href,
  linkLabel = "Ver todo",
  children,
  className = "",
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 className="text-lg font-bold md:text-xl">{title}</h2>
        {href ? (
          <Link href={href} className="flex items-center text-sm font-medium text-brand-blue">
            {linkLabel}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-2xl bg-surface-muted ${className}`} />;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4 md:mb-6">
      <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-muted md:text-base">{subtitle}</p> : null}
    </div>
  );
}
