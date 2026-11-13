"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Download, Share, SquarePlus } from "lucide-react";

/** Evento de Chrome/Android para ofrecer la instalación (no existe en iOS). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const noopSubscribe = () => () => {};

function useIsStandalone() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(display-mode: standalone)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
}

function useIsIos() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    () => false,
  );
}

export function InstallAppCard() {
  const isStandalone = useIsStandalone();
  const isIos = useIsIos();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-semibold">App en tu celular</h2>

      {isStandalone || installed ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <CheckCircle2 className="size-5 text-brand-blue" aria-hidden />
          Ya tienes la app instalada.
        </p>
      ) : isIos ? (
        <>
          <p className="mt-1 text-sm text-muted">Instálala para abrirla como una app y recibir avisos:</p>
          <ol className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Share className="size-5 shrink-0 text-brand-blue" aria-hidden />
              1. En Safari, toca <strong>Compartir</strong>.
            </li>
            <li className="flex items-center gap-2">
              <SquarePlus className="size-5 shrink-0 text-brand-blue" aria-hidden />
              2. Elige <strong>Agregar a inicio</strong>.
            </li>
          </ol>
        </>
      ) : promptEvent ? (
        <>
          <p className="mt-1 text-sm text-muted">Ábrela como una app, a pantalla completa y con avisos.</p>
          <button
            type="button"
            onClick={install}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-blue font-semibold text-white"
          >
            <Download className="size-5" aria-hidden />
            Instalar app
          </button>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">
          Abre el menú del navegador y elige <strong>Instalar app</strong> o <strong>Agregar a pantalla de inicio</strong>.
        </p>
      )}
    </section>
  );
}
