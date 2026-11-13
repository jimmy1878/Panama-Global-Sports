import type { Metadata } from "next";
import { Suspense } from "react";
import { InstallAppCard } from "@/components/pwa/install-app-card";
import { AccountCard, AccountCardFallback } from "./account-card";

export const metadata: Metadata = { title: "Más" };

export default function MasPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold md:text-3xl">Más</h1>
      {/* Móvil: una columna de tarjetas. Desktop: dos columnas. */}
      <div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-2 md:gap-6">
        <Suspense fallback={<AccountCardFallback />}>
          <AccountCard />
        </Suspense>
        <InstallAppCard />
      </div>
    </div>
  );
}
