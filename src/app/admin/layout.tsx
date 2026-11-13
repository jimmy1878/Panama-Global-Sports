import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/section";
import { requireRole } from "@/lib/auth";
import { AdminNav, AdminNavList } from "./admin-nav";

export const metadata: Metadata = {
  title: { default: "Administración", template: "%s · Admin · Panama Global Sports" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="md:grid md:grid-cols-[13rem_1fr] md:gap-8">
      <aside className="md:sticky md:top-24 md:self-start">
        <Suspense fallback={<AdminNavList />}>
          <AdminNav />
        </Suspense>
      </aside>
      <div className="min-w-0">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </div>
    </div>
  );
}

/** Solo administradores. La seguridad real la imponen RLS y las funciones de la BD. */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireRole(["admin"], "/admin");
  return children;
}
