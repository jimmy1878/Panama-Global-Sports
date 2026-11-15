"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DESKTOP_NAV, isActive } from "./nav-items";

/** Enlaces del menú superior (desktop). */
export function DesktopNav() {
  return <DesktopNavList pathname={usePathname()} />;
}

/** Sin `pathname` se renderiza sin estado activo (fallback de Suspense). */
export function DesktopNavList({ pathname }: { pathname?: string }) {
  return (
    <ul className="flex items-center gap-0.5">
      {DESKTOP_NAV.map(({ href, label, soon }) => {
        if (soon) {
          return (
            <li key={href}>
              {/* En el diseño pero sin pantalla todavía: visible y apagado */}
              <span
                title="Próximamente"
                className="cursor-default rounded-lg px-3 py-2 text-[15px] font-semibold text-white/35"
              >
                {label}
              </span>
            </li>
          );
        }
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-[15px] font-semibold transition-colors ${
                active ? "text-gold" : "text-white hover:text-gold"
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
