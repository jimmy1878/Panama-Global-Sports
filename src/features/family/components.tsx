"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Check, Medal, ShieldAlert, ShieldCheck } from "lucide-react";
import { setFollow, setPhotoConsent, voteMvp } from "@/app/familia/actions";

/** Interruptor de consentimiento de foto (padre/madre). Pide confirmación al retirarlo. */
export function ConsentToggle({ playerId, consent, childName }: { playerId: string; consent: boolean; childName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(consent);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  function toggle() {
    const next = !optimistic;
    const question = next
      ? `¿Autorizas mostrar la foto de ${childName} en la app (plantel, figuritas y galería de la liga)?`
      : `¿Retirar el consentimiento? La foto de ${childName} dejará de mostrarse de inmediato.`;
    if (!window.confirm(question)) return;
    startTransition(async () => {
      setOptimistic(next);
      const result = await setPhotoConsent(playerId, next);
      setMessage(result.ok ? { text: result.message ?? "Guardado." } : { text: result.error, error: true });
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl bg-surface-muted p-3">
      <div className="flex items-center gap-3">
        {optimistic ? (
          <ShieldCheck className="size-6 shrink-0 text-brand-blue" aria-hidden />
        ) : (
          <ShieldAlert className="size-6 shrink-0 text-muted" aria-hidden />
        )}
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-semibold">Foto en la app</span>
          <span className="block text-xs text-muted">
            {optimistic ? "Autorizada: se puede mostrar." : "No autorizada: nunca se muestra."}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={optimistic}
          aria-label="Consentimiento de foto"
          disabled={pending}
          onClick={toggle}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${optimistic ? "bg-brand-blue" : "bg-border"}`}
        >
          <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${optimistic ? "left-7" : "left-1"}`} />
        </button>
      </div>
      {message ? <p className={`mt-2 text-xs ${message.error ? "text-brand-red" : "text-muted"}`}>{message.text}</p> : null}
    </div>
  );
}

/** Seguir / dejar de seguir un equipo (para recibir avisos en la fase de notificaciones). */
export function FollowButton({ teamId, following, compact = false }: { teamId: string; following: boolean; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(following);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    startTransition(async () => {
      setOptimistic(!optimistic);
      const result = await setFollow(teamId, !optimistic);
      setError(result.ok ? null : result.error);
      router.refresh();
    });
  }

  const Icon = optimistic ? BellOff : Bell;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={optimistic}
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-60 ${
          compact ? "h-10 px-3 text-sm" : "h-11 px-4 text-sm"
        } ${optimistic ? "border border-border bg-surface text-foreground" : "bg-brand-blue text-white"}`}
      >
        <Icon className="size-4" aria-hidden />
        {optimistic ? "Siguiendo" : "Seguir equipo"}
      </button>
      {error ? <span className="text-xs text-brand-red">{error}</span> : null}
    </span>
  );
}

type VotePlayer = { playerId: string; name: string; number: number; teamName: string };

/** Votación del MVP por las familias (un voto por familia y partido). */
export function MvpVote({ matchId, players, closesAt }: { matchId: string; players: VotePlayer[]; closesAt: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; error?: boolean } | null>(null);
  const teams = [...new Set(players.map((p) => p.teamName))];

  function submit() {
    if (!selected) return;
    const name = players.find((p) => p.playerId === selected)?.name;
    if (!window.confirm(`¿Votar por ${name}? Tu familia tiene un solo voto en este partido.`)) return;
    startTransition(async () => {
      const r = await voteMvp(matchId, selected);
      setResult(r.ok ? { text: r.message ?? "Voto registrado." } : { text: r.error, error: true });
      if (r.ok) router.refresh();
    });
  }

  const closes = new Intl.DateTimeFormat("es-PA", { timeZone: "America/Panama", weekday: "long", hour: "numeric", minute: "2-digit" }).format(
    new Date(closesAt),
  );

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-4">
      <p className="mb-3 text-sm">
        <strong>¡Vota por el jugador del partido!</strong> Tu familia tiene un voto. No se puede votar por un hijo propio. Cierra el{" "}
        {closes}.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => (
          <div key={team}>
            <h3 className="mb-2 text-sm font-semibold">{team}</h3>
            <ul className="grid grid-cols-2 gap-2">
              {players
                .filter((p) => p.teamName === team)
                .map((p) => (
                  <li key={p.playerId}>
                    <button
                      type="button"
                      onClick={() => setSelected(p.playerId)}
                      aria-pressed={selected === p.playerId}
                      className={`flex min-h-12 w-full items-center gap-2 rounded-xl border-2 px-3 text-left text-sm ${
                        selected === p.playerId ? "border-brand-blue bg-brand-blue/10 font-semibold" : "border-transparent bg-surface"
                      }`}
                    >
                      <span className="font-black tabular-nums">{p.number}</span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={!selected || pending}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-blue font-semibold text-white disabled:opacity-50 sm:w-auto sm:px-6"
      >
        <Medal className="size-5" aria-hidden />
        {pending ? "Enviando…" : "Votar"}
      </button>
      {result ? (
        <p className={`mt-2 flex items-center gap-1 text-sm ${result.error ? "text-brand-red" : "text-brand-blue"}`}>
          {result.error ? null : <Check className="size-4" aria-hidden />}
          {result.text}
        </p>
      ) : null}
    </div>
  );
}
