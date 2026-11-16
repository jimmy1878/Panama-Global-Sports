"use client";

/* eslint-disable @next/next/no-img-element -- logo del bucket público, de tamaño ya conocido */

import { useEffect, useRef } from "react";
import type { SponsorPlacement } from "./pick";

export type SponsorVariant = "header" | "match";
/** Sobre navy o sobre fondo claro: cambia el color del texto y qué logo se usa. */
export type SponsorTone = "dark" | "light";

/**
 * El logo del patrocinador.
 *
 * Es cliente por una sola razón: avisar de la impresión. Se cuenta una vez por
 * montaje y con `sendBeacon`, que no retrasa la página ni se pierde si el
 * visitante se va enseguida. El clic lo cuenta el servidor en /api/patrocinio,
 * antes de redirigir, que es lo que pide la especificación.
 */
export function SponsorBanner({
  placement,
  variant = "header",
  tone = "dark",
  className = "",
}: {
  placement: SponsorPlacement;
  variant?: SponsorVariant;
  tone?: SponsorTone;
  className?: string;
}) {
  const contado = useRef(false);

  useEffect(() => {
    if (contado.current) return;
    contado.current = true;
    try {
      navigator.sendBeacon?.(`/api/patrocinio/${placement.id}/vista`);
    } catch {
      // Sin métrica, pero el logo se ve: nunca romper la página por esto.
    }
  }, [placement.id]);

  const small = variant === "match";
  const dark = tone === "dark";
  // Sobre navy manda la versión clara del logo; sobre blanco, la normal
  const logo = dark
    ? (placement.logoDarkUrl ?? placement.imageUrl)
    : (placement.imageUrl ?? placement.logoDarkUrl);

  const inner = (
    <>
      <span
        className={`shrink-0 font-black tracking-widest uppercase ${dark ? "text-white/50" : "text-muted"} ${
          small ? "text-[9px]" : "text-[10px]"
        }`}
      >
        {placement.text ?? "Presentado por"}
      </span>
      {logo ? (
        <img
          src={logo}
          alt={placement.sponsorName}
          loading="lazy"
          className={small ? "max-h-6 w-auto" : "max-h-8 w-auto md:max-h-10"}
        />
      ) : (
        <span
          className={`font-display ${dark ? "text-white" : "text-foreground"} ${small ? "text-sm" : "text-base md:text-lg"}`}
        >
          {placement.sponsorName}
        </span>
      )}
    </>
  );

  const box = `flex items-center gap-2 ${className}`;

  if (!placement.linkUrl) {
    return (
      <span className={box} aria-label={`Patrocinador: ${placement.sponsorName}`}>
        {inner}
      </span>
    );
  }

  return (
    <a
      href={`/api/patrocinio/${placement.id}/ir`}
      target="_blank"
      rel="nofollow sponsored noopener"
      className={`${box} rounded-xl transition-opacity hover:opacity-80`}
      aria-label={`Patrocinador: ${placement.sponsorName}`}
    >
      {inner}
    </a>
  );
}
