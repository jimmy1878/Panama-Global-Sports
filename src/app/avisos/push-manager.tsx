"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { BellOff, BellRing, Send, Share, SquarePlus } from "lucide-react";
import { removeSubscription, savePreferences, saveSubscription, sendTestNotification, type PushResult } from "./actions";

type Support = "checking" | "ok" | "ios-install" | "unsupported" | "denied";

function base64UrlToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Qué permite este navegador (se calcula solo en el cliente). */
function useSupport(): Support {
  return useSyncExternalStore(
    () => () => {},
    () => {
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (isIos && !standalone) return "ios-install"; // en iPhone solo funciona con la app instalada
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      return "ok";
    },
    () => "checking",
  );
}

async function getRegistration() {
  // En desarrollo el service worker no se registra solo: se registra aquí al activar los avisos.
  return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
}

export function PushManager({
  vapidPublicKey,
  initialPrefs,
}: {
  vapidPublicKey: string | null;
  initialPrefs: { match_reminder: boolean; final_result: boolean };
}) {
  const support = useSupport();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (support !== "ok") return;
    navigator.serviceWorker
      .getRegistration("/")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => setSubscribed(false));
  }, [support]);

  const show = (r: PushResult) => setMessage(r.ok ? { text: r.message ?? "Listo." } : { text: r.error, error: true });

  function enable() {
    if (!vapidPublicKey) {
      setMessage({ text: "Las notificaciones aún no están configuradas en el servidor.", error: true });
      return;
    }
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setMessage({ text: "No diste permiso. Puedes activarlo en los ajustes del navegador.", error: true });
          return;
        }
        const reg = await getRegistration();
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(vapidPublicKey) }));
        const result = await saveSubscription(sub.toJSON(), navigator.userAgent);
        show(result);
        setSubscribed(result.ok);
      } catch {
        setMessage({ text: "No se pudieron activar los avisos en este navegador.", error: true });
      }
    });
  }

  function disable() {
    startTransition(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removeSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMessage({ text: "Avisos desactivados en este dispositivo." });
    });
  }

  function togglePref(key: "match_reminder" | "final_result") {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    startTransition(async () => show(await savePreferences(next)));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Este dispositivo */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-1 font-semibold">Este dispositivo</h2>
        {support === "checking" ? (
          <p className="text-sm text-muted">Comprobando…</p>
        ) : support === "ios-install" ? (
          <div className="text-sm">
            <p className="text-muted">En iPhone los avisos solo funcionan con la app instalada:</p>
            <ol className="mt-3 space-y-2">
              <li className="flex items-center gap-2">
                <Share className="size-5 text-brand-blue" aria-hidden /> 1. En Safari, toca <strong>Compartir</strong>.
              </li>
              <li className="flex items-center gap-2">
                <SquarePlus className="size-5 text-brand-blue" aria-hidden /> 2. Elige <strong>Agregar a inicio</strong>.
              </li>
              <li>3. Abre la app desde el ícono y vuelve a esta página.</li>
            </ol>
          </div>
        ) : support === "unsupported" ? (
          <p className="text-sm text-muted">Este navegador no admite avisos. Prueba con Chrome, Edge, Firefox o Safari actualizado.</p>
        ) : support === "denied" ? (
          <p className="text-sm text-brand-red">
            Bloqueaste los avisos para este sitio. Actívalos en los ajustes del navegador (candado junto a la dirección) y recarga.
          </p>
        ) : subscribed ? (
          <>
            <p className="flex items-center gap-2 text-sm text-brand-blue">
              <BellRing className="size-5" aria-hidden /> Avisos activados en este dispositivo.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(async () => show(await sendTestNotification()))}
                className="flex h-11 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Send className="size-4" aria-hidden /> Enviar aviso de prueba
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={disable}
                className="flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60"
              >
                <BellOff className="size-4" aria-hidden /> Desactivar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Activa los avisos para enterarte de los partidos de tus equipos.</p>
            <button
              type="button"
              disabled={pending || subscribed === null}
              onClick={enable}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-blue font-semibold text-white disabled:opacity-60 sm:w-auto sm:px-6"
            >
              <BellRing className="size-5" aria-hidden /> {pending ? "Activando…" : "Activar avisos"}
            </button>
          </>
        )}
        {message ? <p className={`mt-3 text-sm ${message.error ? "text-brand-red" : "text-muted"}`}>{message.text}</p> : null}
      </section>

      {/* Preferencias (valen para todos los dispositivos) */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold">Qué avisos quiero</h2>
        <ul className="space-y-3">
          <PrefRow
            label="Recordatorio el día anterior"
            example="“Tiburones FC juega mañana 9:00 en Cancha 2”"
            checked={prefs.match_reminder}
            disabled={pending}
            onToggle={() => togglePref("match_reminder")}
          />
          <PrefRow
            label="Resultado final"
            example="“Final: Tiburones FC 3 – 1 Halcones FC”"
            checked={prefs.final_result}
            disabled={pending}
            onToggle={() => togglePref("final_result")}
          />
        </ul>
        <p className="mt-3 text-xs text-muted">Solo recibes avisos de los equipos que sigues.</p>
      </section>
    </div>
  );
}

function PrefRow({
  label,
  example,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  example: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted">{example}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${checked ? "bg-brand-blue" : "bg-border"}`}
      >
        <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${checked ? "left-7" : "left-1"}`} />
      </button>
    </li>
  );
}
