import { Suspense } from "react";
import { AccountButton, AccountButtonFallback } from "./account-button";
import { DesktopNav, DesktopNavList } from "./desktop-nav";
import { Logo } from "./logo";

/**
 * Cabecera. En móvil: logo + cuenta (la navegación vive en BottomNav).
 * En desktop: logo + menú superior completo + cuenta.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 md:h-16 md:px-6">
        <Logo />
        <div className="flex items-center gap-4">
          <nav aria-label="Navegación principal" className="hidden md:block">
            <Suspense fallback={<DesktopNavList />}>
              <DesktopNav />
            </Suspense>
          </nav>
          <Suspense fallback={<AccountButtonFallback />}>
            <AccountButton />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
