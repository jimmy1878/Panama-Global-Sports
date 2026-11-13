"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  CircleSlash,
  Flag,
  Hand,
  HandHeart,
  Medal,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Square,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { LiveRefresher } from "@/components/live/live-refresher";
import { minuteSince } from "@/components/live/live-minute";
import type { LiveMatchData, LivePlayer } from "@/features/live/data";
import { addEvent, chooseMvp, finishMatch, setAttendance, setEventVoided, startMatch, type LiveResult } from "../../actions";

type Team = LiveMatchData["match"]["home"];
type EventCode = "goal" | "own_goal" | "save" | "fair_play" | "yellow_card" | "red_card";

const ACTIONS: { code: EventCode; label: string; icon: typeof Trophy; primary?: boolean; tone?: string }[] = [
  { code: "goal", label: "Gol", icon: Trophy, primary: true },
  { code: "save", label: "Atajada", icon: Hand },
  { code: "fair_play", label: "Fair play", icon: HandHeart },
  { code: "own_goal", label: "Autogol", icon: CircleSlash },
  { code: "yellow_card", label: "Amarilla", icon: Square, tone: "text-amber-500" },
  { code: "red_card", label: "Roja", icon: Square, tone: "text-brand-red" },
];

/** Paso del selector de jugador. */
type Picker =
  | { kind: "event"; team: Team; code: EventCode }
  | { kind: "assist"; team: Team; scorerId: string }
  | { kind: "mvp"; team: Team };

const subscribeClock = (cb: () => void) => {
  const id = setInterval(cb, 10_000);
  return () => clearInterval(id);
};

export function LiveConsole({ data }: { data: LiveMatchData }) {
  const { match, canEdit, homeRoster, awayRoster, events, mvps } = data;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picker, setPicker] = useState<Picker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0); // ajuste manual del minuto
  const [showAttendance, setShowAttendance] = useState(false);

  // Reloj (cada 10 s): minuto de juego y ventana de corrección. 0 en el servidor.
  const tick = useSyncExternalStore(subscribeClock, () => Math.floor(Date.now() / 10_000), () => 0);
  const now = tick * 10_000;

  const live = match.status === "live";
  const finished = match.status === "finished";
  const editableAfter = finished && match.finished_at !== null && now - new Date(match.finished_at).getTime() < 3600_000;
  const canLoad = canEdit && (live || editableAfter);

  const autoMinute = match.started_at && tick ? minuteSince(match.started_at, now) : 1;
  const minute = Math.min(150, Math.max(0, autoMinute + offset));

  // Mantener la pantalla encendida mientras el partido está en vivo
  useEffect(() => {
    if (!live || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, [live]);

  function run(action: () => Promise<LiveResult>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      navigator.vibrate?.(30);
      onDone?.();
      router.refresh();
    });
  }

  const rosterOf = (team: Team) => (team.id === match.home.id ? homeRoster : awayRoster);

  function pickPlayer(player: LivePlayer) {
    if (!picker) return;
    const team = picker.team;
    if (picker.kind === "event" && picker.code === "goal") {
      setPicker({ kind: "assist", team, scorerId: player.playerId });
      return;
    }
    if (picker.kind === "event") {
      run(() => addEvent({ matchId: match.id, teamId: team.id, playerId: player.playerId, code: picker.code, minute }), () => setPicker(null));
    } else if (picker.kind === "assist") {
      run(
        () => addEvent({ matchId: match.id, teamId: team.id, playerId: picker.scorerId, code: "goal", minute, assistPlayerId: player.playerId }),
        () => setPicker(null),
      );
    } else {
      run(() => chooseMvp(match.id, player.playerId), () => setPicker(null));
    }
  }

  function goalWithoutAssist() {
    if (picker?.kind !== "assist") return;
    const { team, scorerId } = picker;
    run(() => addEvent({ matchId: match.id, teamId: team.id, playerId: scorerId, code: "goal", minute }), () => setPicker(null));
  }

  const mvpName = (team: Team) => {
    const mvp = mvps.find((m) => m.team_id === team.id);
    return mvp ? rosterOf(team).find((p) => p.playerId === mvp.player_id)?.name ?? "Jugador" : null;
  };

  return (
    <div className="space-y-5 pb-8">
      <LiveRefresher matchId={match.id} delayMs={300} />

      {/* Marcador */}
      <section className="rounded-3xl bg-foreground p-5 text-white">
        <div className="mb-3 flex items-center justify-between text-xs text-white/70">
          <span>
            {match.category?.league?.name} · {match.category?.code}
          </span>
          {live ? (
            <span className="flex items-center gap-1.5 rounded-full bg-brand-red px-2.5 py-1 font-bold text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-white" />
              EN VIVO · {minute}&apos;
            </span>
          ) : finished ? (
            <span className="font-semibold uppercase">Finalizado</span>
          ) : (
            <span className="font-semibold uppercase">Sin empezar</span>
          )}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <TeamName team={match.home} />
          <p className="text-5xl font-black tabular-nums">
            {match.home_score ?? 0}
            <span className="mx-2 text-white/40">–</span>
            {match.away_score ?? 0}
          </p>
          <TeamName team={match.away} />
        </div>
      </section>

      {!canEdit ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          Solo lectura: este partido no está asignado a tu cuenta. Pide a un administrador que te asigne.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-brand-red/10 p-4 text-sm text-brand-red">
          <X className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {/* Iniciar */}
      {canEdit && (match.status === "scheduled" || match.status === "postponed") ? (
        <BigButton onClick={() => run(() => startMatch(match.id))} disabled={pending} icon={Play}>
          Iniciar partido
        </BigButton>
      ) : null}

      {/* Minuto */}
      {live && canEdit ? (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-3">
          <span className="text-sm">
            <span className="block font-medium">Minuto de los eventos</span>
            {offset === 0 ? (
              <span className="block text-xs text-muted">Automático: corre en tiempo real desde el inicio</span>
            ) : (
              <button type="button" onClick={() => setOffset(0)} className="block text-xs font-semibold text-brand-blue">
                Ajustado {offset > 0 ? `+${offset}` : offset} · volver al automático
              </button>
            )}
          </span>
          <div className="flex items-center gap-2">
            <IconButton label="Restar un minuto" onClick={() => setOffset((o) => o - 1)} icon={Minus} />
            <span className="w-12 text-center text-2xl font-black tabular-nums">{minute}&apos;</span>
            <IconButton label="Sumar un minuto" onClick={() => setOffset((o) => o + 1)} icon={Plus} />
          </div>
        </div>
      ) : null}

      {/* Botones por equipo */}
      {canLoad ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[match.home, match.away].map((team) => (
            <section key={team.id} className="rounded-2xl border border-border bg-surface p-3">
              <h2 className="mb-3 flex items-center gap-2 font-bold">
                <span className="size-3 rounded-full" style={{ background: team.primary_color }} aria-hidden />
                {team.name}
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {ACTIONS.map(({ code, label, icon: Icon, primary, tone }) => (
                  <button
                    key={code}
                    type="button"
                    disabled={pending}
                    onClick={() => setPicker({ kind: "event", team, code })}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50 ${
                      primary ? "col-span-3 min-h-20 bg-brand-blue text-lg text-white" : "bg-surface-muted"
                    }`}
                  >
                    <Icon className={`size-5 ${primary ? "size-7" : ""} ${tone ?? ""}`} aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {/* Asistencia */}
      {canLoad ? (
        <section className="rounded-2xl border border-border bg-surface">
          <button
            type="button"
            onClick={() => setShowAttendance((s) => !s)}
            className="flex h-14 w-full items-center gap-2 px-4 text-left font-semibold"
          >
            <Users className="size-5 text-brand-blue" aria-hidden />
            Asistencia
            <span className="ml-auto text-sm font-normal text-muted">
              {homeRoster.filter((p) => p.present).length + awayRoster.filter((p) => p.present).length} presentes ·{" "}
              {showAttendance ? "ocultar" : "editar"}
            </span>
          </button>
          {showAttendance ? (
            <div className="grid gap-4 border-t border-border p-3 md:grid-cols-2">
              {[match.home, match.away].map((team) => (
                <div key={team.id}>
                  <h3 className="mb-2 text-sm font-semibold">{team.name}</h3>
                  <ul className="grid grid-cols-2 gap-2">
                    {rosterOf(team).map((p) => (
                      <li key={p.playerId}>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => setAttendance(match.id, team.id, p.playerId, !p.present))}
                          className={`flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-left text-sm ${
                            p.present ? "bg-brand-blue/10 font-medium" : "bg-surface-muted text-muted line-through"
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
          ) : null}
        </section>
      ) : null}

      {/* Finalizar */}
      {live && canEdit ? (
        <BigButton
          onClick={() => window.confirm("¿Finalizar el partido? El marcador quedará como resultado final.") && run(() => finishMatch(match.id))}
          disabled={pending}
          icon={Flag}
          tone="danger"
        >
          Finalizar partido
        </BigButton>
      ) : null}

      {/* MVP */}
      {finished ? (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-1 flex items-center gap-2 font-bold">
            <Medal className="size-5 text-amber-500" aria-hidden />
            Jugador del partido
          </h2>
          {match.category?.league?.mvp_mode === "parent_vote" ? (
            <p className="mb-3 text-sm text-muted">
              En esta liga votan las familias durante {match.category.league.mvp_vote_hours} h. Si hay empate, podrás elegir aquí al
              cerrar la votación.
            </p>
          ) : (
            <p className="mb-3 text-sm text-muted">Elige un jugador de cada equipo.</p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {[match.home, match.away].map((team) => (
              <div key={team.id} className="flex items-center gap-3 rounded-xl bg-surface-muted p-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted">{team.name}</span>
                  <span className="block truncate font-semibold">{mvpName(team) ?? "Sin elegir"}</span>
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setPicker({ kind: "mvp", team })}
                    className="h-11 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {mvpName(team) ? "Cambiar" : "Elegir"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Eventos cargados */}
      <section>
        <h2 className="mb-2 font-bold">Eventos ({events.filter((e) => !e.voided).length})</h2>
        {events.length ? (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {events.map((e) => {
              const team = e.teamId === match.home.id ? match.home : match.away;
              return (
                <li key={e.id} className={`flex items-center gap-3 px-4 py-3 ${e.voided ? "opacity-50" : ""}`}>
                  <span className="w-9 text-sm font-bold text-muted tabular-nums">{e.minute ?? "–"}&apos;</span>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: team.primary_color }} aria-hidden />
                  <span className={`min-w-0 flex-1 text-sm ${e.voided ? "line-through" : ""}`}>
                    <span className="font-semibold">{e.label}</span> · {e.playerName}
                  </span>
                  {canLoad ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => setEventVoided(match.id, e.id, !e.voided))}
                      className="flex h-10 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-brand-red disabled:opacity-50"
                    >
                      {e.voided ? <RotateCcw className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
                      {e.voided ? "Restaurar" : "Anular"}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">Aún no hay eventos.</p>
        )}
        {finished && canEdit && !editableAfter ? (
          <p className="mt-2 text-xs text-muted">Pasó más de 1 hora del final: para corregir, pide ayuda a un administrador.</p>
        ) : null}
      </section>

      {picker ? (
        <PlayerSheet
          title={
            picker.kind === "assist"
              ? "¿Quién dio la asistencia?"
              : picker.kind === "mvp"
                ? `Jugador del partido · ${picker.team.name}`
                : `${ACTIONS.find((a) => a.code === picker.code)?.label} · ${picker.team.name}`
          }
          subtitle={picker.kind === "event" && picker.code === "own_goal" ? "Elige al jugador de este equipo que la metió en su arco: suma para el rival." : undefined}
          players={rosterOf(picker.team).filter((p) => picker.kind !== "assist" || p.playerId !== picker.scorerId)}
          pending={pending}
          onPick={pickPlayer}
          onClose={() => setPicker(null)}
          extra={
            picker.kind === "assist" ? (
              <button
                type="button"
                disabled={pending}
                onClick={goalWithoutAssist}
                className="h-14 w-full rounded-xl bg-surface-muted font-semibold disabled:opacity-50"
              >
                Sin asistencia
              </button>
            ) : null
          }
        />
      ) : null}
    </div>
  );
}

function TeamName({ team }: { team: Team }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="grid size-12 place-items-center rounded-full border-2 text-xs font-black"
        style={{ background: team.primary_color, borderColor: team.secondary_color, color: team.secondary_color }}
      >
        {(team.short_name ?? team.name).slice(0, 3).toUpperCase()}
      </span>
      <span className="line-clamp-2 text-sm font-semibold">{team.name}</span>
    </div>
  );
}

function BigButton({
  children,
  onClick,
  disabled,
  icon: Icon,
  tone = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon: typeof Play;
  tone?: "primary" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-16 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold transition-transform active:scale-[0.98] disabled:opacity-50 ${
        tone === "danger" ? "border-2 border-brand-red text-brand-red" : "bg-brand-blue text-white"
      }`}
    >
      <Icon className="size-6" aria-hidden />
      {disabled ? "Un momento…" : children}
    </button>
  );
}

function IconButton({ label, onClick, icon: Icon }: { label: string; onClick: () => void; icon: typeof Plus }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid size-11 place-items-center rounded-xl bg-surface-muted">
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

/** Hoja inferior con los jugadores en botones grandes (presentes primero). */
function PlayerSheet({
  title,
  subtitle,
  players,
  pending,
  onPick,
  onClose,
  extra,
}: {
  title: string;
  subtitle?: string;
  players: LivePlayer[];
  pending: boolean;
  onPick: (p: LivePlayer) => void;
  onClose: () => void;
  extra?: React.ReactNode;
}) {
  const [showAbsent, setShowAbsent] = useState(false);
  const present = players.filter((p) => p.present);
  const list = showAbsent || present.length === 0 ? players : present;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 md:items-center md:justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:max-w-lg md:rounded-3xl">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-lg font-bold">{title}</h2>
            {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-11 place-items-center rounded-xl bg-surface-muted">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {list.map((p) => (
            <li key={p.playerId}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onPick(p)}
                className={`flex h-20 w-full flex-col items-center justify-center rounded-xl border-2 px-1 transition-transform active:scale-95 disabled:opacity-50 ${
                  p.present ? "border-border bg-surface" : "border-dashed border-border bg-surface-muted text-muted"
                }`}
              >
                <span className="text-2xl font-black tabular-nums">{p.number}</span>
                <span className="w-full truncate text-center text-xs">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {present.length > 0 && present.length < players.length ? (
          <button type="button" onClick={() => setShowAbsent((s) => !s)} className="mt-3 flex items-center gap-1 text-sm font-medium text-brand-blue">
            <CircleCheck className="size-4" aria-hidden />
            {showAbsent ? "Ver solo presentes" : `Mostrar ausentes (${players.length - present.length})`}
          </button>
        ) : null}
        {extra ? <div className="mt-3">{extra}</div> : null}
      </div>
    </div>
  );
}
