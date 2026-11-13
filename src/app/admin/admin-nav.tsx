"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users } from "lucide-react";
import { ADMIN_SECTIONS } from "@/features/admin/sections";

function isActive(pathname: string | undefined, href: string) {
  if (!pathname) return false;
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/** Móvil: pestañas deslizables. Desktop: barra lateral. */
export function AdminNav() {
  return <AdminNavList pathname={usePathname()} />;
}

export function AdminNavList({ pathname }: { pathname?: string }) {
  return (
    <nav aria-label="Secciones del panel" className="-mx-4 mb-5 md:mx-0 md:mb-0">
      <p className="mb-2 hidden items-center gap-2 px-3 text-xs font-semibold tracking-wide text-muted uppercase md:flex">
        <Users className="size-4" aria-hidden />
        Administración
      </p>
      <ul className="flex gap-2 overflow-x-auto px-4 pb-1 md:flex-col md:gap-1 md:px-0">
        {ADMIN_SECTIONS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap md:rounded-xl md:px-3 ${
                  active
                    ? "bg-brand-blue text-white md:bg-brand-blue/10 md:text-brand-blue"
                    : "border border-border bg-surface md:border-0 md:bg-transparent md:text-muted md:hover:bg-surface-muted md:hover:text-foreground"
                }`}
              >
                <Icon className="hidden size-4 md:block" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
