import Link from "next/link";
import { Suspense } from "react";
import { AccountButton, AccountButtonFallback } from "./account-button";
import { BrandBackdrop } from "./brand-backdrop";
import { DesktopNav, DesktopNavList } from "./desktop-nav";
import { Logo } from "./logo";
import { TodayBar, TodayBarFallback } from "./today-bar";

/**
 * Cabecera de marca: degradado navy, balón de fondo y dorado.
 * En móvil solo logo y cuenta (la navegación vive en BottomNav); en desktop,
 * el menú completo del diseño y el botón de inscripciones.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
      <div className="bg-brand-gradient relative text-white">
        <BrandBackdrop />
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:h-20 md:px-6">
          <Logo />
          <div className="flex items-center gap-3">
            <nav aria-label="Navegación principal" className="hidden lg:block">
              <Suspense fallback={<DesktopNavList />}>
                <DesktopNav />
              </Suspense>
            </nav>
            <Link
              href="/ingresar"
              className="hidden h-11 items-center rounded-xl bg-gold px-5 font-display text-base tracking-wide text-navy uppercase md:flex"
            >
              Inscripciones
            </Link>
            <Suspense fallback={<AccountButtonFallback />}>
              <AccountButton />
            </Suspense>
          </div>
        </div>
      </div>
      {/* Barra "Hoy": los partidos del día, en juego o no */}
      <Suspense fallback={<TodayBarFallback />}>
        <TodayBar />
      </Suspense>
    </header>
  );
}
