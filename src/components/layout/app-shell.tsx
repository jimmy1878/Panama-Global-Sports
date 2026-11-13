import { Suspense } from "react";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { BottomNav, BottomNavBar } from "./bottom-nav";
import { SiteHeader } from "./site-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorkerRegister />
      <SiteHeader />
      <OfflineBanner />
      {/* En móvil se reserva espacio abajo para el menú fijo. */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:px-6 md:pt-8 md:pb-12">
        {children}
      </main>
      <Suspense fallback={<BottomNavBar />}>
        <BottomNav />
      </Suspense>
    </>
  );
}
