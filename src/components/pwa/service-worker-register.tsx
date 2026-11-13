"use client";

import { useEffect } from "react";

/**
 * Registra /sw.js. Solo en producción: en desarrollo un service worker
 * interfiere con la recarga en caliente. Para probar la PWA en local:
 * `npm run build` y luego `npm start`.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sin service worker la app sigue funcionando; solo pierde la página sin conexión y los avisos.
    });
  }, []);

  return null;
}
