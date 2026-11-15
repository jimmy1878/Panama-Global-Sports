"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./nav-items";

/** Enlaces del menú superior (desktop). */
export function DesktopNav() {
  return <DesktopNavList pathname={usePathname()} />;
}

/** Sin `pathname` se renderiza sin estado activo (fallback de Suspense). */
export function DesktopNavList({ pathname }: { pathname?: string }) {
  return (
    <ul className="flex items-center gap-1">
      {NAV_ITEMS.map(({ href, label }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                active ? "bg-white/10 text-gold" : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
