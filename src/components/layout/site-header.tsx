import { Suspense } from "react";
import { DesktopNav, DesktopNavList } from "./desktop-nav";
import { Logo } from "./logo";

/**
 * Cabecera. En móvil es una barra simple con el logo (la navegación vive en BottomNav);
 * en desktop incluye el menú superior completo.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:h-16 md:px-6">
        <Logo />
        <nav aria-label="Navegación principal" className="hidden md:block">
          <Suspense fallback={<DesktopNavList />}>
            <DesktopNav />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
