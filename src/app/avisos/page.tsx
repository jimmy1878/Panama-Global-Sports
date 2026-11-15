import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageTitle, Section, Skeleton } from "@/components/ui/section";
import { TeamCrest } from "@/components/ui/team-crest";
import { getFollowedTeamIds } from "@/features/family/data";
import { getCurrentTeams } from "@/features/league/data";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PushManager } from "./push-manager";

export const metadata: Metadata = { title: "Avisos", robots: { index: false } };

export default function AvisosPage() {
  return (
    <div>
      <PageTitle title="Avisos" subtitle="Recordatorios y resultados de los equipos que sigues." />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <AvisosContent />
      </Suspense>
    </div>
  );
}

async function AvisosContent() {
  const user = await requireUser("/avisos");
  const supabase = await createClient();
  const [{ data: prefs }, followedIds, allTeams] = await Promise.all([
    supabase.from("notification_preferences").select("match_reminder, final_result").eq("user_id", user.id).maybeSingle(),
    getFollowedTeamIds(),
    getCurrentTeams(),
  ]);
  const teams = allTeams.filter((t) => followedIds.includes(t.id));

  return (
    <div className="space-y-8">
      <PushManager
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null}
        initialPrefs={{ match_reminder: prefs?.match_reminder ?? true, final_result: prefs?.final_result ?? true }}
      />

      <Section title="Equipos que sigues" href="/familia" linkLabel="Mi familia">
        {teams.length ? (
          <ul className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <li key={t.id}>
                <Link href={`/equipos/${t.id}`} className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pr-4 pl-1">
                  <TeamCrest team={t} size="sm" />
                  <span className="text-sm font-medium">{t.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            No sigues ningún equipo todavía: no recibirás avisos. Entra a un{" "}
            <Link href="/equipos" className="font-medium text-brand-blue">
              equipo
            </Link>{" "}
            y pulsa <strong>Seguir equipo</strong>.
          </p>
        )}
      </Section>
    </div>
  );
}
