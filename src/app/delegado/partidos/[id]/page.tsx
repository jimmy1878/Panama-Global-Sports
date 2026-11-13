import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/section";
import { getLiveMatch } from "@/features/live/data";
import { isUuid } from "@/features/league/data";
import { LiveConsole } from "./live-console";

export const metadata: Metadata = { title: "Marcador", robots: { index: false } };

export default function LiveMatchPage({ params }: PageProps<"/delegado/partidos/[id]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/delegado" className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue">
          <ChevronLeft className="size-4" aria-hidden />
          Mis partidos
        </Link>
        <Suspense>
          {params.then(({ id }) => (
            <Link href={`/partidos/${id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue">
              Vista pública
              <ExternalLink className="size-4" aria-hidden />
            </Link>
          ))}
        </Suspense>
      </div>
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        {params.then(({ id }) => (
          <Console id={id} />
        ))}
      </Suspense>
    </div>
  );
}

async function Console({ id }: { id: string }) {
  if (!isUuid(id)) notFound();
  const data = await getLiveMatch(id);
  if (!data) notFound();
  return <LiveConsole data={data} />;
}
